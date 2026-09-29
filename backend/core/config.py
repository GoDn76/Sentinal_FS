import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SentinelFS Forensic Backend"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "sentinelfs_super_secret_forensic_key_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://postgres:357951@localhost:5432/sentinelfs"
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    RUST_CARVER_PATH: str = os.getenv(
        "RUST_CARVER_PATH", 
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sentinel-carver/target/release/sentinel-carver.exe"))
    )

    class Config:
        case_sensitive = True

settings = Settings()
