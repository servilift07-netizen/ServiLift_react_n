# app/services/reglas.py
# Reglas de negocio puras (sin base de datos ni HTTP): se prueban como unidad en tests/unit.
# Lo que depende del reloj recibe "hoy" por parámetro para que las pruebas sean repetibles.

from datetime import date, time

from fastapi import HTTPException

from app.tiempo import hoy as hoy_colombia


def validar_horario(fecha_programada: date | None, hora_inicio: time | None, hora_fin: time | None,
                    hoy: date | None = None):
    """Una visita no se programa en un día pasado (hoy sí se puede) y debe terminar después de empezar."""
    hoy = hoy or hoy_colombia()
    if fecha_programada and fecha_programada < hoy:
        raise HTTPException(400, "No se puede programar una visita en un día pasado")
    if hora_inicio and hora_fin and hora_fin <= hora_inicio:
        raise HTTPException(400, "El fin estimado debe ser después de la hora de inicio")


def numero_parametro(valor: str) -> str:
    """Valor de un parámetro numérico del sistema: acepta coma decimal y debe ser mayor o igual a 0."""
    normalizado = valor.strip().replace(",", ".")
    try:
        if float(normalizado) < 0:
            raise ValueError
    except ValueError:
        raise HTTPException(400, "El valor debe ser un número mayor o igual a 0 (ej. 2.2)")
    return normalizado
