"""
Central configuration for MediSight AI backend.

All secrets/config come from environment variables (.env in dev).
Never commit a real .env file — see .env.example.
"""
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory, regardless of the process's current working directory,
# so the default SQLite file always lands in the same place whether you run
# `uvicorn app.main:app` from backend/ or `python -m ml.src.train_model`
# from the repo root.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_SQLITE_PATH = os.path.join(BACKEND_DIR, "medisight_dev.db")


class Settings(BaseSettings):
    # --- Core ---
    APP_NAME: str = "MediSight AI"
    ENV: str = "development"

    # --- Database ---
    # Defaults to a local SQLite file so the MVP runs with zero external
    # services. Point DATABASE_URL at Postgres in real deployments, e.g.
    # postgresql+psycopg2://user:pass@localhost:5432/medisight
    DATABASE_URL: str = f"sqlite:///{DEFAULT_SQLITE_PATH}"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "CHANGE_ME_DEV_ONLY_NOT_FOR_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- QR tokens ---
    QR_TOKEN_BYTES: int = 32  # entropy of the random QR access token
    QR_TOKEN_EXPIRE_MINUTES: int = 15  # short-lived, revocable

    # --- Privacy ---
    K_ANONYMITY_THRESHOLD: int = 5

    # --- CORS ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
