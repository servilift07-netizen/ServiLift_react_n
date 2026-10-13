"""Reglas puras de programación y parámetros. "hoy" se fija en la prueba (FIRST: repeatable)."""
from datetime import date, time

import pytest
from fastapi import HTTPException

from app.services.reglas import numero_parametro, validar_horario

HOY = date(2026, 10, 12)


# ---------------------------------------------------------------- programar visita
@pytest.mark.parametrize(
    "fecha",
    [
        HOY,                    # borde: hoy sí se puede programar
        date(2026, 10, 13),     # mañana
        None,                   # reprogramación sin cambiar la fecha
    ],
)
def test_validar_horario_accepts_today_and_future_days(fecha):
    validar_horario(fecha, time(8, 0), time(10, 0), hoy=HOY)


def test_validar_horario_rejects_a_past_day():
    # Arrange: borde, ayer
    ayer = date(2026, 10, 11)

    # Act + Assert
    with pytest.raises(HTTPException) as error:
        validar_horario(ayer, time(8, 0), time(10, 0), hoy=HOY)
    assert error.value.status_code == 400
    assert error.value.detail == "No se puede programar una visita en un día pasado"


@pytest.mark.parametrize(
    ("inicio", "fin"),
    [
        (time(8, 0), time(8, 0)),    # borde: termina a la misma hora
        (time(8, 0), time(7, 59)),
    ],
)
def test_validar_horario_rejects_an_end_time_not_after_the_start(inicio, fin):
    with pytest.raises(HTTPException, match="400"):
        validar_horario(HOY, inicio, fin, hoy=HOY)


def test_validar_horario_accepts_an_end_one_minute_after_the_start():
    validar_horario(HOY, time(8, 0), time(8, 1), hoy=HOY)


# ---------------------------------------------------------------- parámetros numéricos
@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        ("2.2", "2.2"),
        ("2,2", "2.2"),     # coma decimal del teclado colombiano
        ("0", "0"),         # borde: el 0 es válido
        (" 2,5 ", "2.5"),
    ],
)
def test_numero_parametro_normalizes_valid_numbers(valor, esperado):
    assert numero_parametro(valor) == esperado


@pytest.mark.parametrize("valor", ["-0.1", "-1", "", "abc", "2,2,2"])
def test_numero_parametro_rejects_negative_or_non_numeric_values(valor):
    with pytest.raises(HTTPException) as error:
        numero_parametro(valor)
    assert error.value.detail == "El valor debe ser un número mayor o igual a 0 (ej. 2.2)"
