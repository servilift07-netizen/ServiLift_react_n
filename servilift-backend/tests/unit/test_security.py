"""Contraseñas, enlaces de descarga de PDF y enlaces firmados de fotos.
El reloj se pasa por parámetro (ahora_s) o se crea el enlace ya vencido: nada depende de la hora real."""
from types import SimpleNamespace as N

import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import settings
from app.security import (
    create_access_token, crear_enlace_descarga, hash_password, leer_enlace_descarga, url_archivo,
    validar_url_archivo, verify_password,
)

AHORA = 1_790_000_000  # instante fijo para las pruebas


# ---------------------------------------------------------------- contraseñas
def test_verify_password_accepts_the_original_password():
    hashed = hash_password("123456")

    assert hashed != "123456"
    assert verify_password("123456", hashed) is True


def test_verify_password_rejects_a_different_password():
    assert verify_password("1234567", hash_password("123456")) is False


def test_verify_password_returns_false_when_the_stored_hash_is_corrupt():
    assert verify_password("123456", "no-es-un-hash-bcrypt") is False


# ---------------------------------------------------------------- token de sesión
def test_access_token_carries_user_role_and_client():
    # Arrange
    usuario = N(id_usuario=5, rol_codigo="CLIENTE", id_cliente=3)

    # Act
    token = create_access_token(usuario)

    # Assert
    datos = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert (datos["sub"], datos["rol"], datos["id_cliente"]) == ("5", "CLIENTE", 3)


# ---------------------------------------------------------------- enlaces de PDF
def test_download_link_returns_the_file_and_its_name():
    enlace = crear_enlace_descarga("informes/INF-1.pdf", "INF-1.pdf")

    assert leer_enlace_descarga(enlace.removeprefix("/descargas/")) == ("informes/INF-1.pdf", "INF-1.pdf")


def test_download_link_is_rejected_when_it_expired():
    vencido = crear_enlace_descarga("informes/INF-1.pdf", "INF-1.pdf", minutos=-1).removeprefix("/descargas/")

    with pytest.raises(HTTPException) as error:
        leer_enlace_descarga(vencido)
    assert error.value.status_code == 404


def test_session_token_cannot_be_used_as_a_download_link():
    # Un token válido pero con otro uso (el de sesión) no abre archivos
    token = create_access_token(N(id_usuario=5, rol_codigo="ADMIN", id_cliente=None))

    with pytest.raises(HTTPException, match="Enlace inválido"):
        leer_enlace_descarga(token)


# ---------------------------------------------------------------- fotos y firmas
def _partes(url):
    ruta, consulta = url.removeprefix("/archivos/").split("?")
    v, f = (p.split("=")[1] for p in consulta.split("&"))
    return ruta, int(v), f


def test_url_archivo_is_none_without_a_file():
    assert url_archivo(None) is None and url_archivo("") is None


def test_signed_photo_url_is_valid_before_it_expires():
    # Arrange
    ruta, vence, firma = _partes(url_archivo("inspecciones/1/foto.jpg", ahora_s=AHORA))

    # Act + Assert: un segundo antes del vencimiento sigue siendo válida (borde)
    validar_url_archivo(ruta, vence, firma, ahora_s=vence)
    assert vence > AHORA + settings.ARCHIVOS_URL_MINUTOS * 60


def test_signed_photo_url_is_rejected_one_second_after_it_expires():
    ruta, vence, firma = _partes(url_archivo("inspecciones/1/foto.jpg", ahora_s=AHORA))

    with pytest.raises(HTTPException) as error:
        validar_url_archivo(ruta, vence, firma, ahora_s=vence + 1)
    assert error.value.status_code == 404


def test_signed_photo_url_is_rejected_when_the_path_is_changed():
    _, vence, firma = _partes(url_archivo("inspecciones/1/foto.jpg", ahora_s=AHORA))

    with pytest.raises(HTTPException):
        validar_url_archivo("inspecciones/2/otra.jpg", vence, firma, ahora_s=AHORA)


def test_signed_photo_url_keeps_the_same_link_within_the_same_hour():
    # Se redondea a la hora para que el celular aproveche su caché
    assert url_archivo("x.jpg", ahora_s=AHORA) == url_archivo("x.jpg", ahora_s=AHORA + 59)
