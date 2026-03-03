from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./alignspeak.db"
    jwt_secret: str = "alignspeak-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_seconds: int = 60 * 60 * 12  # 12h

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
