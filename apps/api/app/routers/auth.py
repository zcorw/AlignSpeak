import secrets
import string
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limiter import rate_limiter
from app.core.security import (
    create_access_token,
    hash_password,
    normalize_email,
    validate_password_strength,
    verify_password,
)
from app.db import get_db
from app.deps import get_current_user
from app.models import EmailVerificationCode, InvitationCode, InvitationCodeUsage, User
from app.schemas.auth import (
    BootstrapAdminRequest,
    BootstrapAdminResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    CreateInvitationCodeResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RegisterRequest,
    RegisterResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFICATION_CODE_TTL_SECONDS = 15 * 60
VERIFICATION_CODE_LENGTH = 6
INVITATION_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check_dual_rate_limit(request: Request, email: str, scope: str) -> None:
    ip = _get_client_ip(request)
    if scope == "register":
        ip_allowed = rate_limiter.is_allowed(
            key=f"register:ip:{ip}",
            window_seconds=settings.register_ip_limit_window,
            max_requests=settings.register_ip_limit_max,
        )
        email_allowed = rate_limiter.is_allowed(
            key=f"register:email:{email}",
            window_seconds=settings.register_email_limit_window,
            max_requests=settings.register_email_limit_max,
        )
    else:
        ip_allowed = rate_limiter.is_allowed(
            key=f"login:ip:{ip}",
            window_seconds=settings.login_ip_limit_window,
            max_requests=settings.login_ip_limit_max,
        )
        email_allowed = rate_limiter.is_allowed(
            key=f"login:email:{email}",
            window_seconds=settings.login_email_limit_window,
            max_requests=settings.login_email_limit_max,
        )

    if not ip_allowed or not email_allowed:
        raise AppError(
            code="RATE_LIMITED",
            message="Too many requests. Please try again later.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


def _new_verification_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(VERIFICATION_CODE_LENGTH))


def _upsert_verification_code(db: Session, email: str, user_id: str, code: str) -> None:
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(seconds=VERIFICATION_CODE_TTL_SECONDS)
    entry = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.email == email))
    if entry is None:
        db.add(
            EmailVerificationCode(
                email=email,
                user_id=user_id,
                code=code,
                expires_at=expires_at,
                created_at=now,
                updated_at=now,
            )
        )
        return

    entry.user_id = user_id
    entry.code = code
    entry.expires_at = expires_at
    entry.updated_at = now


def _get_verification_entry(db: Session, email: str) -> EmailVerificationCode | None:
    return db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.email == email))


def _dev_verification_code(code: str) -> str | None:
    if settings.app_env.lower() == "production":
        return None
    return code


def _count_users(db: Session) -> int:
    return int(db.scalar(select(func.count(User.id))) or 0)


def _new_invitation_code(db: Session) -> str:
    for _ in range(8):
        body = "".join(secrets.choice(INVITATION_CODE_ALPHABET) for _ in range(settings.invitation_code_length))
        code = f"INV-{body}"
        exists = db.scalar(select(InvitationCode.id).where(InvitationCode.code == code))
        if exists is None:
            return code
    raise AppError(
        code="INVITATION_CODE_GENERATION_FAILED",
        message="Failed to generate invitation code. Please try again.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _assert_admin(user: User) -> None:
    if user.role != "admin":
        raise AppError(
            code="FORBIDDEN",
            message="Admin permission is required.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def _get_invitation_code_for_update(db: Session, raw_code: str) -> InvitationCode:
    normalized = raw_code.strip().upper()
    if not normalized:
        raise AppError(
            code="AUTH_INVITATION_REQUIRED",
            message="Invitation code is required.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    invitation = db.scalar(
        select(InvitationCode)
        .where(InvitationCode.code == normalized)
        .with_for_update()
    )
    if invitation is None or invitation.status != "active":
        raise AppError(
            code="AUTH_INVITATION_INVALID",
            message="Invitation code is invalid.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if invitation.used_count >= invitation.max_uses:
        raise AppError(
            code="AUTH_INVITATION_EXHAUSTED",
            message="Invitation code has reached its usage limit.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    return invitation


def _get_usage_by_user_id(db: Session, user_id: str) -> InvitationCodeUsage | None:
    return db.scalar(select(InvitationCodeUsage).where(InvitationCodeUsage.user_id == user_id))


@router.post("/bootstrap-admin", response_model=BootstrapAdminResponse, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(payload: BootstrapAdminRequest, request: Request, db: Session = Depends(get_db)) -> BootstrapAdminResponse:
    if _count_users(db) > 0:
        raise AppError(
            code="AUTH_BOOTSTRAP_CLOSED",
            message="Bootstrap is already completed.",
            status_code=status.HTTP_409_CONFLICT,
        )
    configured_key = settings.bootstrap_admin_key.strip()
    if not configured_key:
        raise AppError(
            code="AUTH_BOOTSTRAP_DISABLED",
            message="Bootstrap admin key is not configured.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    if not secrets.compare_digest(payload.bootstrap_key, configured_key):
        raise AppError(
            code="FORBIDDEN",
            message="Invalid bootstrap key.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    normalized_email = normalize_email(payload.email)
    _check_dual_rate_limit(request=request, email=normalized_email, scope="register")
    validate_password_strength(payload.password)
    existing = db.scalar(select(User).where(User.email == normalized_email))
    if existing is not None:
        raise AppError(
            code="AUTH_EMAIL_ALREADY_EXISTS",
            message="Email already registered.",
            status_code=status.HTTP_409_CONFLICT,
        )

    now = datetime.now(tz=timezone.utc)
    user = User(
        id=f"usr_{uuid4().hex[:12]}",
        email=normalized_email,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or normalized_email.split("@")[0][:20]).strip(),
        role="admin",
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()

    return BootstrapAdminResponse(
        user_id=user.id,
        role=user.role,
        message="Bootstrap admin created successfully.",
    )


@router.post("/invitation-codes", response_model=CreateInvitationCodeResponse, status_code=status.HTTP_201_CREATED)
def create_invitation_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateInvitationCodeResponse:
    _assert_admin(current_user)
    now = datetime.now(tz=timezone.utc)
    invitation = InvitationCode(
        id=f"inv_{uuid4().hex[:12]}",
        code=_new_invitation_code(db),
        created_by_user_id=current_user.id,
        max_uses=settings.invitation_code_max_uses,
        used_count=0,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    remaining = max(invitation.max_uses - invitation.used_count, 0)
    return CreateInvitationCodeResponse(
        invitation_code_id=invitation.id,
        code=invitation.code,
        max_uses=invitation.max_uses,
        used_count=invitation.used_count,
        remaining_uses=remaining,
        status=invitation.status,
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> RegisterResponse:
    if _count_users(db) == 0:
        raise AppError(
            code="AUTH_BOOTSTRAP_REQUIRED",
            message="No users found. Please bootstrap admin first.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    normalized_email = normalize_email(payload.email)
    _check_dual_rate_limit(request=request, email=normalized_email, scope="register")
    validate_password_strength(payload.password)

    existing = db.scalar(select(User).where(User.email == normalized_email))
    now = datetime.now(tz=timezone.utc)

    if existing is not None and existing.status == "active":
        return RegisterResponse(
            user_id=existing.id,
            message="Email already registered. Please sign in.",
            verification_required=False,
            verification_code=None,
        )
    if existing is not None and existing.status == "disabled":
        raise AppError(
            code="FORBIDDEN",
            message="Account is disabled.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if existing is None:
        user = User(
            id=f"usr_{uuid4().hex[:12]}",
            email=normalized_email,
            password_hash=hash_password(payload.password),
            display_name=(payload.display_name or normalized_email.split("@")[0][:20]).strip(),
            role="user",
            status="pending",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
    else:
        user = existing
        user.password_hash = hash_password(payload.password)
        user.display_name = (payload.display_name or normalized_email.split("@")[0][:20]).strip()
        user.status = "pending"
        user.updated_at = now

    usage = _get_usage_by_user_id(db=db, user_id=user.id)
    if usage is None:
        invitation = _get_invitation_code_for_update(db=db, raw_code=payload.invitation_code)
        invitation.used_count += 1
        invitation.updated_at = now
        db.add(invitation)
        db.add(
            InvitationCodeUsage(
                invitation_code_id=invitation.id,
                user_id=user.id,
                used_at=now,
            )
        )

    code = _new_verification_code()
    _upsert_verification_code(db=db, email=normalized_email, user_id=user.id, code=code)
    db.commit()

    return RegisterResponse(
        user_id=user.id,
        message="Verification code sent. Please verify before login.",
        verification_required=True,
        verification_code=_dev_verification_code(code),
    )


@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> VerifyEmailResponse:
    normalized_email = normalize_email(payload.email)
    _check_dual_rate_limit(request=request, email=normalized_email, scope="login")

    entry = _get_verification_entry(db=db, email=normalized_email)
    if entry is None:
        raise AppError(
            code="AUTH_VERIFICATION_REQUIRED",
            message="No valid verification code. Please register again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if entry.expires_at < datetime.now(tz=timezone.utc):
        db.delete(entry)
        db.commit()
        raise AppError(
            code="AUTH_VERIFICATION_CODE_EXPIRED",
            message="Verification code expired. Please register again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if not secrets.compare_digest(entry.code, payload.code):
        raise AppError(
            code="AUTH_VERIFICATION_CODE_INVALID",
            message="Invalid verification code.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    user = db.scalar(select(User).where(User.id == entry.user_id))
    if user is None:
        db.delete(entry)
        db.commit()
        raise AppError(
            code="AUTH_VERIFICATION_REQUIRED",
            message="No valid verification code. Please register again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    user.status = "active"
    user.updated_at = datetime.now(tz=timezone.utc)
    db.delete(entry)
    db.commit()

    return VerifyEmailResponse(
        user_id=user.id,
        message="Email verified. You can now sign in.",
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    normalized_email = normalize_email(payload.email)
    _check_dual_rate_limit(request=request, email=normalized_email, scope="login")

    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppError(
            code="AUTH_INVALID_CREDENTIALS",
            message="Invalid email or password.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if user.status == "pending":
        raise AppError(
            code="AUTH_EMAIL_NOT_VERIFIED",
            message="Email not verified.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if user.status != "active":
        raise AppError(
            code="FORBIDDEN",
            message="Account is not active.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    now = datetime.now(tz=timezone.utc)
    user.last_login_at = now
    user.updated_at = now
    db.commit()

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        token_version=user.token_version,
    )
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_seconds,
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        user_id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        display_name=current_user.display_name,
        status=current_user.status,
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChangePasswordResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise AppError(
            code="AUTH_INVALID_CREDENTIALS",
            message="Current password is incorrect.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    validate_password_strength(payload.new_password)
    if verify_password(payload.new_password, current_user.password_hash):
        raise AppError(
            code="VALIDATION_ERROR",
            message="New password must be different from current password.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.now(tz=timezone.utc)
    db.add(current_user)
    db.commit()

    return ChangePasswordResponse(message="Password changed successfully.")
