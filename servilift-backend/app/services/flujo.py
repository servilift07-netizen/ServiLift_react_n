# app/services/flujo.py
# Numeración consecutiva, máquina de estados por equipo y notificaciones.

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Consecutivo, Cotizacion, CotizacionEquipo, HistorialEstado, Notificacion, Parametro, Rol, Usuario,
)
from app.tiempo import ahora

# ============================================
# CONSECUTIVOS: COT-2026-0001, INS-..., INF-..., CER-...
# ============================================
def siguiente_numero(db: Session, prefijo: str) -> str:
    anio = ahora().year
    fila = db.execute(
        select(Consecutivo).where(Consecutivo.prefijo == prefijo, Consecutivo.anio == anio).with_for_update()
    ).scalar_one_or_none()
    if fila is None:
        fila = Consecutivo(prefijo=prefijo, anio=anio, ultimo_numero=0)
        db.add(fila)
    fila.ultimo_numero += 1
    db.flush()
    return f"{prefijo}-{anio}-{fila.ultimo_numero:04d}"


# ============================================
# ESTADOS POR EQUIPO (cotizacion_equipo.estado)
# ============================================
TRANSICIONES = {
    "PENDIENTE_APROBACION": {"APROBADO_CLIENTE", "RECHAZADO", "ANULADO"},
    "APROBADO_CLIENTE": {"POR_PROGRAMAR", "ANULADO"},
    "POR_PROGRAMAR": {"PROGRAMADO", "ANULADO"},
    "PROGRAMADO": {"EN_INSPECCION", "POR_PROGRAMAR", "SEGUNDA_VISITA_SOLICITADA", "ANULADO"},
    "EN_INSPECCION": {"EN_REVISION", "POR_PROGRAMAR", "NO_CONFORME"},
    # 1ª visita: conforme -> INFORME_APROBADO, no conforme -> NO_CONFORME.
    # 2ª visita: todo corregido -> INFORME_APROBADO, algo sin corregir -> CERRADO_NO_CONFORME (no hay 3ª visita).
    "EN_REVISION": {"INFORME_APROBADO", "NO_CONFORME", "CERRADO_NO_CONFORME", "EN_INSPECCION"},
    "NO_CONFORME": {"SEGUNDA_VISITA_SOLICITADA"},          # el cliente o el asesor la solicita
    "SEGUNDA_VISITA_SOLICITADA": {"PROGRAMADO"},          # programación agenda el cierre de hallazgos
    "INFORME_APROBADO": {"CERTIFICADO_LISTO"},
    "CERTIFICADO_LISTO": set(),
    "CERRADO_NO_CONFORME": set(),                         # el equipo necesita una cotización nueva
    "RECHAZADO": set(),
    "ANULADO": set(),
}

ESTADOS_FINALES = {"CERTIFICADO_LISTO", "CERRADO_NO_CONFORME", "RECHAZADO", "ANULADO"}

ETIQUETAS_ESTADO = {
    "PENDIENTE_APROBACION": "Pendiente por aprobación",
    "APROBADO_CLIENTE": "Aprobado",
    "POR_PROGRAMAR": "Por programar",
    "PROGRAMADO": "Programado",
    "EN_INSPECCION": "En inspección",
    "EN_REVISION": "En revisión técnica",
    "NO_CONFORME": "No conforme: solicitar segunda visita",
    "SEGUNDA_VISITA_SOLICITADA": "Segunda visita solicitada",
    "INFORME_APROBADO": "Informe disponible",
    "CERTIFICADO_LISTO": "Certificado listo",
    "CERRADO_NO_CONFORME": "No conforme en 2ª visita: requiere cotización nueva",
    "RECHAZADO": "Rechazado",
    "ANULADO": "Anulado",
}


def puede_pasar(actual: str, nuevo: str) -> bool:
    """True si la máquina de estados permite ir de "actual" a "nuevo"."""
    return nuevo in TRANSICIONES.get(actual, set())


def cambiar_estado(db: Session, ce: CotizacionEquipo, nuevo: str, usuario: Usuario | None, comentario: str | None = None):
    if ce.estado == nuevo:
        return
    if not puede_pasar(ce.estado, nuevo):
        raise HTTPException(409, f"El equipo {ce.codigo_servicio} está en {ce.estado} y no puede pasar a {nuevo}")
    db.add(HistorialEstado(
        id_cotizacion_equipo=ce.id_cotizacion_equipo,
        estado_anterior=ce.estado,
        estado_nuevo=nuevo,
        id_usuario=usuario.id_usuario if usuario else None,
        comentario=comentario,
    ))
    ce.estado = nuevo
    ce.fecha_estado = ahora()
    _actualizar_estado_cotizacion(ce.cotizacion)


def registrar_evento(db: Session, ce: CotizacionEquipo, usuario: Usuario | None, comentario: str):
    """Deja en el historial del equipo un hecho que no cambia su estado (envío, emisión, reprogramación...)."""
    db.add(HistorialEstado(id_cotizacion_equipo=ce.id_cotizacion_equipo, estado_anterior=ce.estado,
                           estado_nuevo=ce.estado, id_usuario=usuario.id_usuario if usuario else None,
                           comentario=comentario[:500]))


def _actualizar_estado_cotizacion(cot: Cotizacion):
    """Una vez en programación, la cotización pasa a EN_EJECUCION y a FINALIZADA cuando todos sus equipos terminan."""
    if cot.estado not in ("ENVIADA_PROGRAMACION", "EN_EJECUCION"):
        return
    estados = {e.estado for e in cot.equipos}
    if estados and estados <= ESTADOS_FINALES:
        cot.estado = "FINALIZADA"
    elif estados - {"POR_PROGRAMAR"} - ESTADOS_FINALES:
        cot.estado = "EN_EJECUCION"


# ============================================
# NOTIFICACIONES
# ============================================
# Una notificación de trabajo deja de estar "vigente" cuando ese trabajo ya se hizo: así el inicio solo muestra
# lo que el usuario todavía tiene por atender (la notificación sigue en la lista de Notificaciones).
ESTADOS_EQUIPO_POR_INSPECCIONAR = {"PROGRAMADO", "EN_INSPECCION"}
ESTADOS_INSPECCION_POR_TRABAJAR = {"EN_CURSO", "DEVUELTA", "EN_SEGUNDA_VISITA"}


def programacion_pendiente(p, ultima_programacion_de) -> bool:
    """True si la visita aún tiene algún equipo por inspeccionar.
    ultima_programacion_de(id_cotizacion_equipo) da la última programación activa del equipo: si el equipo ya
    tiene otra visita más reciente (p. ej. la 2ª), esta programación vieja ya no cuenta como pendiente."""
    if p is None or p.estado in ("CANCELADA", "REALIZADA"):
        return False
    return any(pe.cotizacion_equipo.estado in ESTADOS_EQUIPO_POR_INSPECCIONAR
               and ultima_programacion_de(pe.id_cotizacion_equipo) == p.id_programacion for pe in p.equipos)


def notificacion_vigente(n, rol: str = "", programacion=None, inspeccion=None, informe=None,
                         ultima_programacion_de=lambda _: None) -> bool:
    """Se decide por el enlace de la notificación (el tipo se repite entre avisos distintos):
    - /inspecciones/agenda (nueva o reprogramada): vigente mientras la visita tenga equipos por inspeccionar.
    - /inspecciones/{id} (informe devuelto): vigente mientras la inspección siga en manos del inspector.
    - /informes/{id} para el director técnico: vigente mientras el informe espere su revisión.
    - El resto (avisos informativos, cotizaciones, certificados...): siempre."""
    enlace = n.enlace or ""
    if enlace == "/inspecciones/agenda":
        return programacion_pendiente(programacion, ultima_programacion_de)
    if enlace.startswith("/inspecciones/"):
        return inspeccion is not None and inspeccion.estado in ESTADOS_INSPECCION_POR_TRABAJAR
    if enlace.startswith("/informes/") and rol == "DIRECTOR_TECNICO":
        return informe is not None and informe.estado == "PENDIENTE_REVISION"
    return True


def notificar(db: Session, usuarios, titulo: str, mensaje: str, tipo: str, id_referencia: int | None = None,
              enlace: str | None = None):
    for u in usuarios:
        db.add(Notificacion(id_usuario_destino=u.id_usuario, titulo=titulo[:120], mensaje=mensaje[:500],
                            tipo=tipo, id_referencia=id_referencia, enlace=enlace))


def usuarios_por_rol(db: Session, codigo_rol: str):
    return db.query(Usuario).join(Rol).filter(Rol.codigo == codigo_rol, Usuario.estado == "ACTIVO").all()


def usuarios_del_cliente(db: Session, id_cliente: int):
    return db.query(Usuario).filter(Usuario.id_cliente == id_cliente, Usuario.estado == "ACTIVO").all()


def parametro(db: Session, clave: str, defecto: str = "") -> str:
    p = db.get(Parametro, clave)
    return p.valor if p else defecto
