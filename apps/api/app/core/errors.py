from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.code, exc.message, exc.status_code)


async def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return error_response(
        code="VALIDATION_ERROR",
        message="Invalid request parameters.",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return error_response(
        code="INTERNAL_ERROR",
        message="Internal server error.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
