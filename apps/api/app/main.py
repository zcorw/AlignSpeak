from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.core.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.db import Base, engine
from app.routers.auth import router as auth_router
from app.routers.protected import router as protected_router

app = FastAPI(title="AlignSpeak API", version="0.1.0")

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(protected_router)
