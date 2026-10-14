"""Reglas del checklist: resumen de hallazgos, concepto de cada visita y plazo de corrección.
Sin base de datos: las inspecciones se arman en memoria con SimpleNamespace y una Norma real."""
from types import SimpleNamespace as N

import pytest

from app.models import Norma
from app.services.checklist import (
    calcular_plazo, concepto_de_visita, pendientes_segunda_visita, resumen,
)

NORMA = Norma(plazo_dias_leve=180, plazo_dias_grave=30, plazo_dias_muy_grave=0)


def resultado(resultado, calificacion="LEVE", segunda=None, numero=1, plazo_item=None):
    item = N(numero=numero, calificacion=calificacion, plazo_dias=plazo_item)
    return N(resultado=resultado, calificacion_defecto=calificacion if resultado == "NO_CUMPLE" else None,
             estado_segunda_visita=segunda, item=item)


def inspeccion(*resultados, firmas=()):
    return N(resultados=list(resultados), norma=NORMA, firmas=list(firmas))


# ---------------------------------------------------------------- resumen
def test_resumen_counts_findings_by_rating_and_second_visit_state():
    # Arrange
    insp = inspeccion(
        resultado("NO_CUMPLE", "LEVE", "CORREGIDO"),
        resultado("NO_CUMPLE", "GRAVE", "NO_CORREGIDO"),
        resultado("NO_CUMPLE", "MUY_GRAVE"),
        resultado("CUMPLE"),
        resultado("NO_APLICA"),
        resultado("NO_VERIFICADO"),
    )

    # Act
    r = resumen(insp)

    # Assert
    assert r == {"leves": 1, "graves": 1, "muy_graves": 1, "no_aplica": 1, "cumple": 1, "calificados": 5,
                 "corregidos": 1, "no_corregidos": 1, "total_no_cumple": 3}


def test_resumen_of_an_empty_inspection_is_all_zeros():
    r = resumen(inspeccion())

    assert r["calificados"] == 0 and r["total_no_cumple"] == 0


# ---------------------------------------------------------------- concepto
@pytest.mark.parametrize(
    ("total_no_cumple", "corregidos", "visita", "concepto"),
    [
        (0, 0, 1, "CONFORME"),      # 1ª visita sin hallazgos
        (1, 0, 1, "NO_CONFORME"),   # borde: un solo hallazgo ya hace no conforme
        (1, 1, 1, "NO_CONFORME"),   # en la 1ª visita "corregido" no cuenta
        (3, 3, 2, "CONFORME"),      # 2ª visita: todo corregido
        (3, 2, 2, "NO_CONFORME"),   # borde: falta uno solo por corregir
        (0, 0, 2, "CONFORME"),
    ],
)
def test_concepto_de_visita(total_no_cumple, corregidos, visita, concepto):
    r = {"total_no_cumple": total_no_cumple, "corregidos": corregidos}

    assert concepto_de_visita(r, visita) == concepto


# ---------------------------------------------------------------- plazo
def test_calcular_plazo_returns_none_when_there_are_no_findings():
    assert calcular_plazo(inspeccion(resultado("CUMPLE"), resultado("NO_APLICA"))) is None


def test_calcular_plazo_uses_the_strictest_deadline_among_the_findings():
    # Arrange: un leve (180 días) y un grave (30 días)
    insp = inspeccion(resultado("NO_CUMPLE", "LEVE"), resultado("NO_CUMPLE", "GRAVE"), resultado("CUMPLE", "MUY_GRAVE"))

    # Act
    plazo = calcular_plazo(insp)

    # Assert: manda el más exigente; el ítem muy grave que cumple no cuenta
    assert plazo == 30


def test_calcular_plazo_is_zero_when_there_is_a_very_serious_finding():
    insp = inspeccion(resultado("NO_CUMPLE", "LEVE"), resultado("NO_CUMPLE", "MUY_GRAVE"))

    assert calcular_plazo(insp) == 0


def test_calcular_plazo_prefers_the_item_own_deadline_over_the_norm():
    # El ítem 12 tiene su propio plazo (15 días) aunque su calificación sea leve
    insp = inspeccion(resultado("NO_CUMPLE", "LEVE", plazo_item=15), resultado("NO_CUMPLE", "GRAVE"))

    assert calcular_plazo(insp) == 15


def test_calcular_plazo_accepts_an_item_deadline_of_zero():
    # Borde: plazo propio 0 no debe confundirse con "sin plazo" (None)
    insp = inspeccion(resultado("NO_CUMPLE", "LEVE", plazo_item=0))

    assert calcular_plazo(insp) == 0


# ---------------------------------------------------------------- 2ª visita
FIRMAS_V2 = [N(tipo_firmante=t, numero_visita=2) for t in ("INSPECTOR", "TECNICO_MANTENIMIENTO", "REPRESENTANTE_EDIFICIO")]


def test_pendientes_segunda_visita_is_empty_when_findings_are_marked_and_signed():
    insp = inspeccion(resultado("NO_CUMPLE", segunda="CORREGIDO", numero=4), resultado("CUMPLE"), firmas=FIRMAS_V2)

    assert pendientes_segunda_visita(insp) == []


def test_pendientes_segunda_visita_lists_unmarked_findings_and_missing_signatures():
    # Arrange: hallazgos 7 y 3 sin marcar; firmas solo de la 1ª visita
    insp = inspeccion(resultado("NO_CUMPLE", numero=7), resultado("NO_CUMPLE", numero=3),
                      firmas=[N(tipo_firmante="INSPECTOR", numero_visita=1)])

    # Act
    errores = pendientes_segunda_visita(insp)

    # Assert
    assert errores[0] == "Hallazgos sin marcar como corregido / no corregido: 3, 7"
    assert "Falta la firma del inspector (segunda visita)" in errores
    assert len(errores) == 4
