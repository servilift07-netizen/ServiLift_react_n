# app/tiempo.py
# Fechas y horas del sistema. Todo se guarda en hora de Colombia (UTC-5) sin zona en la base
# (DATETIME); la API las entrega con el desfase (-05:00) para que el celular y el navegador
# las interpreten bien sin importar la zona configurada en el dispositivo.

from datetime import date, datetime, timedelta, timezone

from app.config import settings


def _zona() -> timezone:
    signo = -1 if settings.ZONA_HORARIA.startswith("-") else 1
    horas, minutos = settings.ZONA_HORARIA.lstrip("+-").split(":")
    return timezone(signo * timedelta(hours=int(horas), minutes=int(minutos)))


ZONA = _zona()


def ahora() -> datetime:
    """Fecha y hora actual de Colombia, sin zona (como se guarda en la base)."""
    return datetime.now(ZONA).replace(tzinfo=None)


def hoy() -> date:
    return ahora().date()


def a_local(v: datetime | None) -> datetime | None:
    """Convierte una fecha recibida del cliente (con o sin zona) a hora de Colombia sin zona."""
    if v is None:
        return None
    if v.tzinfo is not None:
        v = v.astimezone(ZONA).replace(tzinfo=None)
    return v


def con_zona(v: datetime) -> datetime:
    """Fecha de la base (sin zona) -> con el desfase de Colombia, para serializar."""
    return v.replace(tzinfo=ZONA) if v.tzinfo is None else v
