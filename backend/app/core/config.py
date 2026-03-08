from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HACKAI Figma Backend"
    app_env: str = "dev"
    api_v1_prefix: str = "/api/v1"
    mongodb_uri: str | None = None
    mongodb_db_name: str = "hackai"
    auto_adapt_on_snapshot: bool = False
    llm_provider: str = "groq"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    google_api_key: str | None = None

    # Keep env loading flexible; no secrets required yet.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
