# app/routes/seguimiento.py
# Búsqueda por número de cotización, nombre de cliente / edificio / equipo y estado por equipo
# (también es la vista del portal del cliente).

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CotizacionEquipo, HistorialEstado, Usuario
from app.routes.serializers import _f, plazo_dict
from app.security import ADMIN, ASESOR, CLIENTE, INSPECTOR, PROGRAMACION, get_current_user
from app.services.flujo import (
    ETIQUETAS_ESTADO, cambiar_estado, notificar, usuarios_del_cliente, usuarios_por_rol,
)
from app.tiempo import ahora

router = APIRouter(tags=["Seguimiento"])

CAMPOS_INFORME = ("id_informe", "numero_informe", "estado_informe", "concepto")


def _valor(v):
    """Fechas a ISO y horas (MySQL TIME llega como timedelta) a HH:MM:SS."""
    if isinstance(v, timedelta):
        seg = int(v.total_seconds())
        return f"{seg // 3600:02d}:{seg % 3600 // 60:02d}:{seg % 60:02d}"
    return _f(v)


def _fila_seguimiento(r, rol: str) -> dict:
    d = {k: _valor(v) for k, v in r.items()}
    d["estado_etiqueta"] = ETIQUETAS_ESTADO.get(r["estado_equipo"], r["estado_equipo"])
    d.update(plazo_dict(r["plazo_dias"], r["fecha_limite_correccion"], r["estado_equipo"]))
    if rol == CLIENTE:
        # El cliente no ve datos internos de revisión: solo informes aprobados y certificados enviados
        for k in ("estado_inspeccion", "numero_inspeccion", "id_inspeccion"):
            d[k] = None
        for v in (1, 2):
            if r[f"estado_informe_v{v}"] != "APROBADO":
                for c in CAMPOS_INFORME:
                    d[f"{c}_v{v}"] = None
        if r["estado_certificado"] != "ENVIADO_CLIENTE":
            d["id_certificado"] = d["numero_certificado"] = d["estado_certificado"] = d["fecha_vencimiento"] = None
    # Informe "vigente" del equipo: el de 2ª visita si existe, si no el de 1ª
    v = 2 if d.get("id_informe_v2") else 1
    for c in CAMPOS_INFORME:
        d[c] = d.get(f"{c}_v{v}")
    d["informe_visita1"] = d.get("estado_informe_v1") == "APROBADO"
    d["informe_visita2"] = d.get("estado_informe_v2") == "APROBADO"
    return d


@router.get("/seguimiento")
def seguimiento(numero_cotizacion: str | None = None, buscar: str | None = None, id_cliente: int | None = None,
                estado: str | None = None, id_edificio: int | None = None, id_equipo: int | None = None,
                solo_mios: bool = False, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    """Una fila por equipo cotizado con su estado actual, programación, informes (1ª y 2ª visita) y certificado.
    buscar: texto en el nombre del cliente, del edificio, del equipo o en el código del servicio."""
    filtros, params = ["1=1"], {}
    if usuario.rol_codigo == CLIENTE:
        filtros.append("v.id_cliente = :cli AND v.estado_cotizacion <> 'BORRADOR'")
        params["cli"] = usuario.id_cliente
    elif id_cliente:
        filtros.append("v.id_cliente = :cli")
        params["cli"] = id_cliente
    if usuario.rol_codigo == INSPECTOR:  # solo los equipos que le han programado
        filtros.append("v.id_cotizacion_equipo IN (SELECT pe.id_cotizacion_equipo FROM programacion_equipo pe "
                       "JOIN programacion p ON p.id_programacion = pe.id_programacion WHERE p.id_inspector = :insp)")
        params["insp"] = usuario.id_usuario
    if solo_mios and usuario.rol_codigo == ASESOR:
        filtros.append("v.id_asesor = :ase")
        params["ase"] = usuario.id_usuario
    if numero_cotizacion:
        filtros.append("v.numero_cotizacion LIKE :num")
        params["num"] = f"%{numero_cotizacion.strip()}%"
    if buscar and buscar.strip():
        filtros.append("(v.cliente LIKE :b OR v.edificio LIKE :b OR v.equipo LIKE :b OR v.codigo_servicio LIKE :b)")
        params["b"] = f"%{buscar.strip()}%"
    if estado:
        filtros.append("v.estado_equipo = :est")
        params["est"] = estado
    if id_edificio:
        filtros.append("v.id_edificio = :edi")
        params["edi"] = id_edificio
    if id_equipo:
        filtros.append("v.id_equipo = :equ")
        params["equ"] = id_equipo
    sql = (f"SELECT v.* FROM v_seguimiento_equipo v WHERE {' AND '.join(filtros)} "
           f"ORDER BY v.numero_cotizacion DESC, v.codigo_servicio")
    return [_fila_seguimiento(r, usuario.rol_codigo) for r in db.execute(text(sql), params).mappings()]


@router.get("/seguimiento/equipo/{id_cotizacion_equipo}/historial")
def historial(id_cotizacion_equipo: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    ce = db.get(CotizacionEquipo, id_cotizacion_equipo)
    if not ce or (usuario.rol_codigo == CLIENTE and ce.cotizacion.id_cliente != usuario.id_cliente):
        raise HTTPException(404, "Equipo no encontrado")
    eventos = (db.query(HistorialEstado).filter(HistorialEstado.id_cotizacion_equipo == id_cotizacion_equipo)
               .order_by(HistorialEstado.fecha, HistorialEstado.id_historial).all())
    salida = []
    for h in eventos:
        d = {"estado_anterior": h.estado_anterior, "estado_nuevo": h.estado_nuevo, "fecha": _f(h.fecha)}
        d["evento"] = h.estado_anterior == h.estado_nuevo   # hecho sin cambio de estado
        d["estado_etiqueta"] = (h.comentario if d["evento"] else ETIQUETAS_ESTADO.get(h.estado_nuevo, h.estado_nuevo))
        if usuario.rol_codigo != CLIENTE:
            d["usuario"] = h.usuario.nombre_completo if h.usuario else None
            d["comentario"] = None if d["evento"] else h.comentario
        salida.append(d)
    return {"codigo_servicio": ce.codigo_servicio, "numero_cotizacion": ce.cotizacion.numero_cotizacion,
            "equipo": ce.equipo.identificacion, "edificio": ce.cotizacion.edificio.nombre,
            "norma": ce.norma.etiqueta, "estado_actual": ce.estado,
            "estado_etiqueta": ETIQUETAS_ESTADO.get(ce.estado, ce.estado), "historial": salida}


class SolicitudIn(BaseModel):
    comentario: str | None = None


@router.post("/seguimiento/equipo/{id_cotizacion_equipo}/solicitar-segunda-visita")
def solicitar_segunda_visita(id_cotizacion_equipo: int, datos: SolicitudIn, db: Session = Depends(get_db),
                             usuario: Usuario = Depends(get_current_user)):
    """El cliente (o su asesor) informa que corrigió los hallazgos y pide la visita de cierre."""
    ce = db.get(CotizacionEquipo, id_cotizacion_equipo)
    if not ce or (usuario.rol_codigo == CLIENTE and ce.cotizacion.id_cliente != usuario.id_cliente):
        raise HTTPException(404, "Equipo no encontrado")
    if usuario.rol_codigo not in (CLIENTE, ASESOR, ADMIN):
        raise HTTPException(403, "Solo el cliente o el asesor pueden solicitar la segunda visita")
    if ce.estado != "NO_CONFORME":
        raise HTTPException(409, "El equipo no está pendiente de segunda visita")
    ce.fecha_solicitud_visita2, ce.id_usuario_solicitud_visita2 = ahora(), usuario.id_usuario
    cambiar_estado(db, ce, "SEGUNDA_VISITA_SOLICITADA", usuario,
                   f"Solicitada por {usuario.nombre_completo}" + (f": {datos.comentario}" if datos.comentario else ""))
    cot = ce.cotizacion
    limite = f" Fecha límite: {ce.fecha_limite_correccion:%d/%m/%Y}." if ce.fecha_limite_correccion else ""
    notificar(db, usuarios_por_rol(db, PROGRAMACION), f"Segunda visita por programar {ce.codigo_servicio}",
              f"{ce.equipo.identificacion} - {cot.edificio.nombre}.{limite}", "PROGRAMACION", cot.id_cotizacion,
              "/programacion/pendientes")
    otros = [cot.asesor] if usuario.rol_codigo == CLIENTE else usuarios_del_cliente(db, cot.id_cliente)
    notificar(db, otros, f"Segunda visita solicitada {ce.codigo_servicio}",
              f"{usuario.nombre_completo} solicitó la segunda visita de {ce.equipo.identificacion}.", "COTIZACION",
              cot.id_cotizacion, f"/cotizaciones/{cot.id_cotizacion}")
    db.commit()
    return {"ok": True, "estado": ce.estado}


@router.get("/dashboard/resumen")
def resumen(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    """Conteo de equipos por estado (para el tablero de cada rol)."""
    q = "SELECT estado_equipo, COUNT(*) n FROM v_seguimiento_equipo"
    params = {}
    if usuario.rol_codigo == CLIENTE:
        q += " WHERE id_cliente = :cli AND estado_cotizacion <> 'BORRADOR'"
        params["cli"] = usuario.id_cliente
    elif usuario.rol_codigo == ASESOR:
        q += " WHERE id_asesor = :ase"   # por id: dos asesores con el mismo nombre ya no se mezclan
        params["ase"] = usuario.id_usuario
    q += " GROUP BY estado_equipo"
    conteo = {r.estado_equipo: r.n for r in db.execute(text(q), params)}
    return [{"estado": e, "etiqueta": et, "cantidad": conteo.get(e, 0)} for e, et in ETIQUETAS_ESTADO.items()]
