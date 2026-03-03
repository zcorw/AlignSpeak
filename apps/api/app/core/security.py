import re
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import status

from app.core.config import settings
from app.core.errors import AppError

password_hasher = PasswordHasher()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Password must be at least 8 characters.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise AppError(
            code="VALIDATION_ERROR",
            message="Password must include both letters and numbers.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


def hash_password(raw_password: str) -> str:
    return password_hasher.hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, raw_password)
    except VerifyMismatchError:
        return False


def create_access_token(subject: str, role: str, token_version: int) -> str:
    now = datetime.now(tz=timezone.utc)
    exp = now + timedelta(seconds=settings.access_token_expire_seconds)
    payload = {
        "sub": subject,
        "role": role,
        "ver": token_version,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise AppError(
            code="UNAUTHORIZED",
            message="Access token expired. Please log in again.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AppError(
            code="UNAUTHORIZED",
            message="Invalid access token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        ) from exc

    if "sub" not in payload or "ver" not in payload:
        raise AppError(
            code="UNAUTHORIZED",
            message="Invalid access token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return payload
