from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise AppError(
            code="UNAUTHORIZED",
            message="Login required.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    payload = decode_access_token(credentials.credentials)
    user_id = str(payload.get("sub"))
    token_version = int(payload.get("ver", -1))

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise AppError(
            code="UNAUTHORIZED",
            message="Login required.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if user.token_version != token_version:
        raise AppError(
            code="UNAUTHORIZED",
            message="Login required.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if user.status != "active":
        raise AppError(
            code="FORBIDDEN",
            message="Account is not active.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    return user
