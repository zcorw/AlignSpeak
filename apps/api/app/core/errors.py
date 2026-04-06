import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
            }
        },
    )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.warning(
        "AppError: method=%s path=%s status=%s code=%s message=%s",
        request.method,
        request.url.path,
        exc.status_code,
        exc.code,
        exc.message,
    )
    return error_response(exc.code, exc.message, exc.status_code)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning(
        "ValidationError: method=%s path=%s errors=%s",
        request.method,
        request.url.path,
        exc.errors(),
    )
    return error_response(
        code="VALIDATION_ERROR",
        message="Invalid request parameters.",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "UnhandledError: method=%s path=%s type=%s message=%s",
        request.method,
        request.url.path,
        type(exc).__name__,
        str(exc),
    )
    return error_response(
        code="INTERNAL_ERROR",
        message="Internal server error.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
