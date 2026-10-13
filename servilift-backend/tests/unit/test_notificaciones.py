"""Qué notificaciones siguen pendientes (las que el inicio muestra en "Lo más reciente").
Programaciones, inspecciones e informes son objetos simples: la prueba no toca MySQL."""
from types import SimpleNamespace as N

import pytest

from app.services.flujo import notificacion_vigente, programacion_pendiente


def aviso(enlace, tipo="PROGRAMACION"):
    return N(enlace=enlace, tipo=tipo)


def visita(id_programacion=1, estado="PROGRAMADA", estados_equipos=("PROGRAMADO",)):
    equipos = [N(id_cotizacion_equipo=10 + i, cotizacion_equipo=N(estado=e)) for i, e in enumerate(estados_equipos)]
    return N(id_programacion=id_programacion, estado=estado, equipos=equipos)


def ultima_es(id_programacion):
    return lambda _id_ce: id_programacion


# ---------------------------------------------------------------- nueva inspección (/inspecciones/agenda)
@pytest.mark.parametrize("estado_equipo", ["PROGRAMADO", "EN_INSPECCION"])
def test_new_inspection_notice_stays_pending_while_the_equipment_is_not_finalized(estado_equipo):
    # Arrange
    p = visita(estados_equipos=(estado_equipo,))

    # Act
    vigente = notificacion_vigente(aviso("/inspecciones/agenda"), "INSPECTOR", programacion=p,
                                   ultima_programacion_de=ultima_es(1))

    # Assert
    assert vigente is True


@pytest.mark.parametrize("estado_equipo", ["EN_REVISION", "NO_CONFORME", "INFORME_APROBADO", "CERTIFICADO_LISTO"])
def test_new_inspection_notice_is_handled_once_the_inspection_went_to_the_director(estado_equipo):
    p = visita(estados_equipos=(estado_equipo,))

    assert notificacion_vigente(aviso("/inspecciones/agenda"), "INSPECTOR", programacion=p,
                                ultima_programacion_de=ultima_es(1)) is False


def test_visit_stays_pending_while_at_least_one_of_its_equipment_is_not_finalized():
    p = visita(estados_equipos=("EN_REVISION", "PROGRAMADO"))

    assert programacion_pendiente(p, ultima_es(1)) is True


@pytest.mark.parametrize("estado_visita", ["CANCELADA", "REALIZADA"])
def test_cancelled_or_done_visit_is_not_pending(estado_visita):
    assert programacion_pendiente(visita(estado=estado_visita), ultima_es(1)) is False


def test_old_first_visit_notice_is_not_pending_when_the_equipment_already_has_a_newer_visit():
    # El equipo volvió a PROGRAMADO, pero por la 2ª visita (programación 2), no por la 1ª
    primera = visita(id_programacion=1, estados_equipos=("PROGRAMADO",))

    assert programacion_pendiente(primera, ultima_es(2)) is False


def test_missing_visit_is_not_pending():
    assert programacion_pendiente(None, ultima_es(1)) is False


# ---------------------------------------------------------------- informe devuelto (/inspecciones/{id})
@pytest.mark.parametrize(("estado", "esperado"), [
    ("DEVUELTA", True), ("EN_CURSO", True), ("EN_SEGUNDA_VISITA", True),
    ("FINALIZADA", False), ("CERRADA", False),
])
def test_returned_report_notice_is_pending_only_while_the_inspector_works_on_it(estado, esperado):
    n = aviso("/inspecciones/7", tipo="INFORME")

    assert notificacion_vigente(n, "INSPECTOR", inspeccion=N(estado=estado)) is esperado


def test_returned_report_notice_without_inspection_is_not_pending():
    assert notificacion_vigente(aviso("/inspecciones/7", tipo="INFORME"), "INSPECTOR", inspeccion=None) is False


# ---------------------------------------------------------------- informe por revisar (/informes/{id})
@pytest.mark.parametrize(("estado", "esperado"), [
    ("PENDIENTE_REVISION", True), ("APROBADO", False), ("DEVUELTO", False),
])
def test_report_to_review_is_pending_for_the_director_only_until_it_is_reviewed(estado, esperado):
    n = aviso("/informes/3", tipo="INFORME")

    assert notificacion_vigente(n, "DIRECTOR_TECNICO", informe=N(estado=estado)) is esperado


def test_approved_report_notice_always_stays_for_the_client():
    # Para el cliente "Informe disponible" es informativo: no se oculta
    n = aviso("/informes/3", tipo="INFORME")

    assert notificacion_vigente(n, "CLIENTE", informe=N(estado="APROBADO")) is True


# ---------------------------------------------------------------- avisos informativos
@pytest.mark.parametrize("enlace", [None, "", "/cotizaciones/1", "/certificados/2", "/programacion/pendientes"])
def test_informative_notices_are_always_pending(enlace):
    assert notificacion_vigente(aviso(enlace), "ASESOR") is True
