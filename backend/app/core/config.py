from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "노후설계 - 한국형 은퇴 금융 운영 플랫폼"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://retirement:retirement@localhost:5432/retirement_db"
    database_pool_size: int = 20
    database_max_overflow: int = 40

    secret_key: str = "change-this-in-production-very-long-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    policies_dir: str = str(Path(__file__).parent.parent.parent / "policies")
    active_policy_year: str = "2026"

    monte_carlo_default_simulations: int = 10000
    monte_carlo_max_simulations: int = 50000

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    redis_url: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
