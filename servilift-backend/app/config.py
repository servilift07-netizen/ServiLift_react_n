# app/config.py

import re

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CLAVES_DE_EJEMPLO = {"cambie-esta-clave", "secret", "changeme", ""}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ============================================
    # BASE DE DATOS
    # ============================================
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_HOST: str = "127.0.0.1"
    DB_PORT: str = "3306"
    DB_NAME: str = "servilift_db"

    # Hora de Colombia (UTC-5, sin horario de verano). Todas las fechas se guardan en esta zona.
    ZONA_HORARIA: str = "-05:00"

    # ============================================
    # JWT - sin valor por defecto: se define en .env
    # ============================================
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 h: una jornada de inspección

    # ============================================
    # ARCHIVOS (fotos, firmas, PDFs)
    # ============================================
    STORAGE_DIR: str = "storage"
    MAX_FOTO_MB: int = 15
    # Las fotos y firmas se sirven con enlaces firmados que vencen (no hay carpeta pública)
    ARCHIVOS_URL_MINUTOS: int = 720

    # URL pública para el QR del certificado
    URL_VERIFICACION: str = "http://localhost:8000/verificar"

    # Orígenes web permitidos (además de localhost en desarrollo), separados por coma
    CORS_ORIGINS: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def _clave_segura(cls, v: str) -> str:
        if v.strip().lower() in CLAVES_DE_EJEMPLO or len(v) < 32:
            raise ValueError("SECRET_KEY insegura: genere una con "
                             "python -c \"import secrets; print(secrets.token_hex(32))\" y póngala en .env")
        return v

    @field_validator("ZONA_HORARIA")
    @classmethod
    def _zona_valida(cls, v: str) -> str:
        if not re.fullmatch(r"[+-]\d{2}:\d{2}", v):
            raise ValueError("ZONA_HORARIA debe tener el formato -05:00")
        return v

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
