# app/security.py
# Contraseñas (bcrypt), tokens JWT y control de acceso por rol.

import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Usuario

# Códigos de rol (tabla rol.codigo)
ADMIN = "ADMIN"
ASESOR = "ASESOR"
CLIENTE = "CLIENTE"
PROGRAMACION = "PROGRAMACION"
INSPECTOR = "INSPECTOR"
DIRECTOR_TECNICO = "DIRECTOR_TECNICO"
CERTIFICADOS = "CERTIFICADOS"

ROLES_INTERNOS = {ADMIN, ASESOR, PROGRAMACION, INSPECTOR, DIRECTOR_TECNICO, CERTIFICADOS}

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(usuario: Usuario) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(usuario.id_usuario),
        "rol": usuario.rol_codigo,
        "id_cliente": usuario.id_cliente,
        "exp": expira,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> Usuario:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o vencido")

    usuario = db.get(Usuario, user_id)
    if not usuario or usuario.estado != "ACTIVO":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo o inexistente")
    return usuario


def require_roles(*roles: str):
    """Dependencia: permite el acceso solo a los roles indicados (ADMIN siempre entra)."""
    permitidos = set(roles) | {ADMIN}

    def _checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol_codigo not in permitidos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tiene permisos para esta acción")
        return usuario

    return _checker


# ============================================
# ENLACES DE DESCARGA (PDF) de corta duración
# La app abre el PDF en el navegador sin enviar el token de sesión en la URL.
# ============================================
def crear_enlace_descarga(ruta_relativa: str, nombre: str, minutos: int = 10) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=minutos)
    token = jwt.encode({"archivo": ruta_relativa, "nombre": nombre, "exp": expira, "uso": "descarga"},
                       settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return f"/descargas/{token}"


def leer_enlace_descarga(token: str) -> tuple[str, str]:
    try:
        datos = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enlace vencido o inválido")
    if datos.get("uso") != "descarga":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enlace inválido")
    return datos["archivo"], datos["nombre"]


# ============================================
# FOTOS Y FIRMAS: enlaces firmados (HMAC) que vencen.
# Ya no existe una carpeta pública: sin firma válida el archivo no se entrega.
# La vigencia se redondea a la hora para que la misma foto conserve la misma URL un rato
# (así el celular la aprovecha desde su caché).
# ============================================
def _firma_archivo(ruta: str, vence: int) -> str:
    msg = f"{ruta}|{vence}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()[:32]


def url_archivo(ruta_relativa: str | None, ahora_s: int | None = None) -> str | None:
    if not ruta_relativa:
        return None
    ahora_s = int(time.time()) if ahora_s is None else ahora_s
    vence = (ahora_s + settings.ARCHIVOS_URL_MINUTOS * 60) // 3600 * 3600 + 3600
    return f"/archivos/{ruta_relativa}?v={vence}&f={_firma_archivo(ruta_relativa, vence)}"


def validar_url_archivo(ruta_relativa: str, vence: int, firma: str, ahora_s: int | None = None):
    """ahora_s solo se pasa en las pruebas, para no depender del reloj."""
    ahora_s = int(time.time()) if ahora_s is None else ahora_s
    if vence < ahora_s or not hmac.compare_digest(firma, _firma_archivo(ruta_relativa, vence)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enlace vencido o inválido")
