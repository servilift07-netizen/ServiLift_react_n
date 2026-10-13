"""Máquina de estados por equipo: solo existen 1ª y 2ª visita.
La sesión de base de datos se reemplaza por una lista: la prueba no toca MySQL."""
from types import SimpleNamespace as N

import pytest
from fastapi import HTTPException

from app.services.flujo import ESTADOS_FINALES, TRANSICIONES, cambiar_estado, puede_pasar


class SesionFalsa:
    """Guarda lo que el servicio agrega, en vez de escribirlo en la base."""

    def __init__(self):
        self.agregados = []

    def add(self, obj):
        self.agregados.append(obj)


def equipo(estado, estado_cotizacion="EN_EJECUCION"):
    cot = N(estado=estado_cotizacion, equipos=[])
    ce = N(id_cotizacion_equipo=1, codigo_servicio="SRV-1", estado=estado, fecha_estado=None, cotizacion=cot)
    cot.equipos.append(ce)
    return ce


@pytest.mark.parametrize(
    ("actual", "nuevo"),
    [
        ("EN_REVISION", "NO_CONFORME"),                 # 1ª visita con hallazgos
        ("NO_CONFORME", "SEGUNDA_VISITA_SOLICITADA"),
        ("SEGUNDA_VISITA_SOLICITADA", "PROGRAMADO"),
        ("EN_REVISION", "CERRADO_NO_CONFORME"),         # 2ª visita con algo sin corregir
        ("INFORME_APROBADO", "CERTIFICADO_LISTO"),
    ],
)
def test_puede_pasar_allows_the_business_transitions(actual, nuevo):
    assert puede_pasar(actual, nuevo) is True


@pytest.mark.parametrize(
    ("actual", "nuevo"),
    [
        ("NO_CONFORME", "INFORME_APROBADO"),            # no se certifica sin 2ª visita
        ("CERRADO_NO_CONFORME", "SEGUNDA_VISITA_SOLICITADA"),  # no existe la 3ª visita
        ("POR_PROGRAMAR", "CERTIFICADO_LISTO"),
        ("ESTADO_INEXISTENTE", "PROGRAMADO"),
    ],
)
def test_puede_pasar_rejects_transitions_outside_the_flow(actual, nuevo):
    assert puede_pasar(actual, nuevo) is False


def test_final_states_have_no_way_out():
    assert all(TRANSICIONES[e] == set() for e in ESTADOS_FINALES)


def test_cambiar_estado_records_history_and_updates_the_equipment():
    # Arrange
    db, ce = SesionFalsa(), equipo("EN_REVISION")
    usuario = N(id_usuario=9)

    # Act
    cambiar_estado(db, ce, "NO_CONFORME", usuario, "Hallazgos graves")

    # Assert
    assert ce.estado == "NO_CONFORME" and ce.fecha_estado is not None
    historial = db.agregados[0]
    assert (historial.estado_anterior, historial.estado_nuevo, historial.id_usuario) == ("EN_REVISION", "NO_CONFORME", 9)


def test_cambiar_estado_rejects_an_invalid_transition_with_409():
    db, ce = SesionFalsa(), equipo("CERRADO_NO_CONFORME")

    with pytest.raises(HTTPException) as error:
        cambiar_estado(db, ce, "SEGUNDA_VISITA_SOLICITADA", None)

    assert error.value.status_code == 409
    assert ce.estado == "CERRADO_NO_CONFORME" and db.agregados == []


def test_cambiar_estado_to_the_same_state_does_nothing():
    db, ce = SesionFalsa(), equipo("PROGRAMADO")

    cambiar_estado(db, ce, "PROGRAMADO", None)

    assert db.agregados == []


def test_quotation_is_finished_when_its_last_equipment_reaches_a_final_state():
    # Arrange
    db, ce = SesionFalsa(), equipo("INFORME_APROBADO")

    # Act
    cambiar_estado(db, ce, "CERTIFICADO_LISTO", None)

    # Assert
    assert ce.cotizacion.estado == "FINALIZADA"
