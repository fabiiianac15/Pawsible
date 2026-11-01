from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    mascotas_api_url: str
    admin_api_key: str = Field(min_length=16)
    internal_api_key: str = Field(min_length=16)
    cors_origins: str = "http://localhost:5173"
    mascotas_timeout_segundos: float = 8.0

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
