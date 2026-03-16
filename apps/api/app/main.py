from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.core.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.db import Base, apply_runtime_schema_fixes, engine
from app.routers.admin import router as admin_router
from app.routers.articles import router as articles_router
from app.routers.auth import router as auth_router
from app.routers.practice import router as practice_router
from app.routers.protected import router as protected_router
from app.routers.tts import router as tts_router

app = FastAPI(title="AlignSpeak API", version="0.1.0")
API_PREFIX = "/api"

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    apply_runtime_schema_fixes()


@app.get(f"{API_PREFIX}/health")
def health_with_prefix() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(articles_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(protected_router, prefix=API_PREFIX)
app.include_router(tts_router, prefix=API_PREFIX)
app.include_router(practice_router, prefix=API_PREFIX)

app.include_router(articles_router, prefix=f"{API_PREFIX}/bff/v1")
