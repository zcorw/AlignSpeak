from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./alignspeak.db"
    jwt_secret: str = "alignspeak-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_seconds: int = 60 * 60 * 12  # 12h

    # OCR provider configuration
    ocr_provider: str = "openai"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_ocr_model: str = "gpt-4.1-mini"
    openai_ocr_timeout_seconds: float = 45.0

    # In-memory rate limit defaults (window seconds + max attempts)
    register_ip_limit_window: int = 60 * 10
    register_ip_limit_max: int = 30
    register_email_limit_window: int = 60 * 10
    register_email_limit_max: int = 5
    login_ip_limit_window: int = 60 * 10
    login_ip_limit_max: int = 30
    login_email_limit_window: int = 60 * 10
    login_email_limit_max: int = 5

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
