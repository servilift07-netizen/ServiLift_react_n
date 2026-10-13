# app/routes/informes.py
# Director técnico: revisa checklist y fotos, devuelve o aprueba (atestación + firma),
# se genera el PDF, queda visible al cliente y, si es conforme, pasa a Certificados.
#
# Hay un informe por visita:
#   · 1ª visita: conforme -> certificados | no conforme -> plazo de corrección y 2ª visita
#   · 2ª visita: todos los hallazgos corregidos -> certificados
#                alguno sin corregir -> CERRADO_NO_CONFORME (requiere cotización nueva; no hay 3ª visita)

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Cotizacion, CotizacionEquipo, Informe, Inspeccion, Usuario
from app.routes.serializers import cot_equipo_dict, fila
from app.security import (
    ADMIN, ASESOR, CERTIFICADOS, CLIENTE, DIRECTOR_TECNICO, crear_enlace_descarga, get_current_user, require_roles,
)
from app.services import archivos, pdf
from app.services.checklist import calcular_plazo, concepto_de_visita, resumen
from app.services.flujo import cambiar_estado, notificar, parametro, usuarios_del_cliente, usuarios_por_rol
from app.tiempo import ahora

router = APIRouter(prefix="/informes", tags=["Informes"])


class DevolverIn(BaseModel):
    observaciones: str


class AprobarIn(BaseModel):
    atestacion: str | None = None
    concepto: str | None = None          # Solo 1ª visita: CONFORME / NO_CONFORME; si no llega se calcula
    firma_base64: str | None = None      # firma como imagen, o
    dibujo: dict | None = None           # firma como trazos {ancho, alto, trazos}; si no llega ninguna se usa la registrada
    observaciones_revision: str | None = None


def informe_dict(inf: Informe) -> dict:
    d = fila(inf, ["id_informe", "numero_informe", "id_inspeccion", "numero_visita", "estado", "concepto",
                   "atestacion", "observaciones_revision", "total_leves", "total_graves", "total_muy_graves",
                   "total_no_aplica", "total_corregidos", "total_no_corregidos",
                   "fecha_revision", "fecha_aprobacion", "fecha_envio_cliente", "fecha_creacion"])
    insp = inf.inspeccion
    ce = insp.cotizacion_equipo
    d["numero_inspeccion"] = insp.numero_inspeccion
    d["norma"] = insp.norma.etiqueta
    d["inspector"] = (insp.inspector_visita2 if inf.numero_visita == 2 and insp.inspector_visita2
                      else insp.inspector).nombre_completo
    d["director"] = inf.director.nombre_completo if inf.director else None
    d["servicio"] = cot_equipo_dict(ce)
    d["numero_cotizacion"] = ce.cotizacion.numero_cotizacion
    d["edificio"] = ce.cotizacion.edificio.nombre
    d["cliente"] = ce.cotizacion.cliente.razon_social
    d["resumen_actual"] = resumen(insp)
    fotos = [f for f in insp.fotos if f.numero_visita <= inf.numero_visita]
    d["total_fotos"] = len(fotos)
    d["fotos_revisadas"] = sum(1 for f in fotos if f.revisada)
    d["tiene_pdf"] = bool(inf.ruta_pdf)
    d["plazo_dias"] = ce.plazo_dias if inf.numero_visita == 1 else None
    d["fecha_limite_correccion"] = fila(ce, ["fecha_limite_correccion"])["fecha_limite_correccion"] \
        if inf.numero_visita == 1 else None
    otro = insp.informe(2 if inf.numero_visita == 1 else 1)
    d["otro_informe"] = fila(otro, ["id_informe", "numero_informe", "numero_visita", "estado", "concepto"]) if otro else None
    d["certificado"] = fila(inf.certificado, ["id_certificado", "numero_certificado", "estado"]) if inf.certificado else None
    return d


def _obtener(db: Session, id_informe: int, usuario: Usuario) -> Informe:
    inf = db.get(Informe, id_informe)
    if not inf:
        raise HTTPException(404, "Informe no encontrado")
    if usuario.rol_codigo == CLIENTE:
        cot = inf.inspeccion.cotizacion_equipo.cotizacion
        if cot.id_cliente != usuario.id_cliente or inf.estado != "APROBADO":
            raise HTTPException(404, "Informe no encontrado")
    return inf


@router.get("")
def listar(estado: str | None = None, numero_cotizacion: str | None = None, numero_visita: int | None = None,
           db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    q = db.query(Informe).join(Inspeccion).join(CotizacionEquipo)
    if usuario.rol_codigo == CLIENTE:
        q = q.join(Cotizacion).filter(Cotizacion.id_cliente == usuario.id_cliente, Informe.estado == "APROBADO")
    elif usuario.rol_codigo not in (DIRECTOR_TECNICO, CERTIFICADOS, ADMIN, ASESOR):
        raise HTTPException(403, "No tiene permisos para ver informes")
    if estado:
        q = q.filter(Informe.estado == estado)
    if numero_visita:
        q = q.filter(Informe.numero_visita == numero_visita)
    if numero_cotizacion:
        q = q.filter(CotizacionEquipo.codigo_servicio.like(f"{numero_cotizacion.strip()}%"))
    return [informe_dict(i) for i in q.order_by(Informe.id_informe.desc()).all()]


@router.get("/{id_informe}")
def obtener(id_informe: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    return informe_dict(_obtener(db, id_informe, usuario))


@router.get("/{id_informe}/pdf")
def descargar_pdf(id_informe: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    inf = _obtener(db, id_informe, usuario)
    if not inf.ruta_pdf:
        raise HTTPException(404, "El informe aún no tiene PDF")
    return FileResponse(archivos.ruta_absoluta(inf.ruta_pdf), media_type="application/pdf",
                        filename=f"{inf.numero_informe}.pdf")


@router.get("/{id_informe}/enlace-pdf")
def enlace_pdf(id_informe: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    """Enlace temporal (10 min) al PDF de este informe (cada visita tiene el suyo)."""
    inf = _obtener(db, id_informe, usuario)
    if not inf.ruta_pdf:
        raise HTTPException(404, "Ese informe aún no tiene PDF")
    return {"url": crear_enlace_descarga(inf.ruta_pdf, f"{inf.numero_informe}.pdf")}


def _congelar_resumen(inf: Informe, r: dict):
    inf.total_leves, inf.total_graves = r["leves"], r["graves"]
    inf.total_muy_graves, inf.total_no_aplica = r["muy_graves"], r["no_aplica"]
    if inf.numero_visita == 2:
        inf.total_corregidos, inf.total_no_corregidos = r["corregidos"], r["no_corregidos"]


@router.get("/{id_informe}/vista-previa")
def vista_previa(id_informe: int, db: Session = Depends(get_db),
                 usuario: Usuario = Depends(require_roles(DIRECTOR_TECNICO))):
    """PDF del informe tal como quedaría, marcado BORRADOR, para revisarlo antes de devolver o aprobar.
    No cambia nada en la base de datos."""
    inf = _obtener(db, id_informe, usuario)
    insp = inf.inspeccion
    if inf.estado != "APROBADO":
        # Valores provisionales solo para el PDF; se descartan con el rollback
        r = resumen(insp)
        inf.concepto = concepto_de_visita(r, inf.numero_visita)
        _congelar_resumen(inf, r)
        if inf.numero_visita == 1 and inf.concepto == "NO_CONFORME":
            ce = insp.cotizacion_equipo
            ce.plazo_dias = calcular_plazo(insp) or 0
            ce.fecha_limite_correccion = (ahora() + timedelta(days=ce.plazo_dias)).date()
        inf.id_director = usuario.id_usuario
        inf.atestacion = inf.atestacion or parametro(db, "TEXTO_ATESTACION")
        db.flush()
    ruta = pdf.generar_informe(db, inf, borrador=True)
    db.rollback()
    return {"url": crear_enlace_descarga(ruta, f"{inf.numero_informe}-borrador.pdf")}


@router.post("/{id_informe}/devolver")
def devolver(id_informe: int, datos: DevolverIn, db: Session = Depends(get_db),
             usuario: Usuario = Depends(require_roles(DIRECTOR_TECNICO))):
    inf = _obtener(db, id_informe, usuario)
    if inf.estado != "PENDIENTE_REVISION":
        raise HTTPException(409, f"El informe está {inf.estado}")
    inf.estado, inf.observaciones_revision = "DEVUELTO", datos.observaciones
    inf.id_director, inf.fecha_revision = usuario.id_usuario, ahora()
    insp = inf.inspeccion
    insp.estado = "EN_SEGUNDA_VISITA" if inf.numero_visita == 2 else "DEVUELTA"
    # La visita vuelve a quedar abierta para que aparezca en la agenda del inspector
    p = insp.programacion_visita2 if inf.numero_visita == 2 else insp.programacion
    if p and p.estado == "REALIZADA":
        p.estado = "EN_CURSO"
    cambiar_estado(db, insp.cotizacion_equipo, "EN_INSPECCION", usuario, f"Devuelto: {datos.observaciones}")
    inspector = insp.inspector_visita2 if inf.numero_visita == 2 else insp.inspector
    notificar(db, [inspector], f"Informe devuelto {inf.numero_informe}", datos.observaciones,
              "INFORME", insp.id_inspeccion, f"/inspecciones/{insp.id_inspeccion}")
    db.commit()
    return informe_dict(inf)


@router.post("/{id_informe}/aprobar")
def aprobar(id_informe: int, datos: AprobarIn, db: Session = Depends(get_db),
            usuario: Usuario = Depends(require_roles(DIRECTOR_TECNICO))):
    inf = _obtener(db, id_informe, usuario)
    if inf.estado != "PENDIENTE_REVISION":
        raise HTTPException(409, f"El informe está {inf.estado}")
    insp = inf.inspeccion
    r = resumen(insp)

    if datos.firma_base64 or datos.dibujo:
        inf.ruta_firma_director = archivos.guardar_firma(f"informes/firmas/{inf.id_informe}", datos.firma_base64,
                                                         datos.dibujo)
    elif usuario.ruta_firma:
        inf.ruta_firma_director = usuario.ruta_firma
    else:
        raise HTTPException(400, "Debe firmar el informe (o registrar su firma en el perfil)")
    if datos.concepto and datos.concepto not in ("CONFORME", "NO_CONFORME"):
        raise HTTPException(400, "Concepto inválido")
    calculado = concepto_de_visita(r, inf.numero_visita)
    if inf.numero_visita == 2 and datos.concepto and datos.concepto != calculado:
        raise HTTPException(409, "En la segunda visita el concepto lo define el cierre de hallazgos: es CONFORME "
                                 "solo si todos quedaron corregidos")
    if calculado == "NO_CONFORME" and datos.concepto == "CONFORME":
        raise HTTPException(409, "El equipo tiene no conformidades: el concepto no puede ser CONFORME")

    ahora_ = ahora()
    inf.id_director = usuario.id_usuario
    inf.concepto = datos.concepto or calculado
    inf.atestacion = datos.atestacion or parametro(db, "TEXTO_ATESTACION")
    inf.observaciones_revision = datos.observaciones_revision
    _congelar_resumen(inf, r)
    inf.fecha_revision = inf.fecha_aprobacion = ahora_
    for f in insp.fotos:
        if f.numero_visita == inf.numero_visita:
            f.revisada = True

    conforme = inf.concepto == "CONFORME"
    ce = insp.cotizacion_equipo
    if inf.numero_visita == 1 and not conforme:
        ce.plazo_dias = calcular_plazo(insp) or 0
        ce.fecha_limite_correccion = (ahora_ + timedelta(days=ce.plazo_dias)).date()
        ce.fecha_solicitud_visita2 = ce.id_usuario_solicitud_visita2 = None
    db.flush()

    inf.ruta_pdf = pdf.generar_informe(db, inf)
    inf.hash_sha256 = archivos.sha256(inf.ruta_pdf)
    inf.estado = "APROBADO"
    inf.fecha_envio_cliente = ahora_
    insp.estado = "CERRADA" if inf.numero_visita == 2 else "APROBADA"

    if conforme:
        nuevo = "INFORME_APROBADO"
    elif inf.numero_visita == 1:
        nuevo = "NO_CONFORME"
    else:
        nuevo = "CERRADO_NO_CONFORME"
    detalle = f"Informe {inf.numero_informe} {inf.concepto.replace('_', ' ')}"
    if nuevo == "NO_CONFORME":
        detalle += f". Plazo de corrección: {ce.plazo_dias} días, hasta {ce.fecha_limite_correccion:%d/%m/%Y}"
    elif nuevo == "CERRADO_NO_CONFORME":
        detalle += f". {r['no_corregidos']} hallazgo(s) sin corregir: requiere cotización nueva"
    cambiar_estado(db, ce, nuevo, usuario, detalle)

    cot = ce.cotizacion
    notificar(db, usuarios_del_cliente(db, cot.id_cliente), f"Informe disponible {inf.numero_informe}",
              f"Ya puede ver y descargar el informe de {'segunda' if inf.numero_visita == 2 else 'primera'} visita de "
              f"{ce.equipo.identificacion} ({cot.edificio.nombre}).",
              "INFORME", inf.id_informe, f"/informes/{inf.id_informe}")
    if conforme:
        inf.fecha_envio_certificados = ahora_
        notificar(db, usuarios_por_rol(db, CERTIFICADOS), f"Certificado por elaborar {ce.codigo_servicio}",
                  f"Informe {inf.numero_informe} conforme. {ce.equipo.identificacion} - {cot.edificio.nombre}.",
                  "CERTIFICADO", inf.id_informe, "/certificados/pendientes")
    elif inf.numero_visita == 1:
        # El certificado queda bloqueado: el cliente o el asesor solicitan la segunda visita dentro del plazo
        notificar(db, usuarios_del_cliente(db, cot.id_cliente) + [cot.asesor],
                  f"Solicite la segunda visita {ce.codigo_servicio}",
                  f"{ce.equipo.identificacion} ({cot.edificio.nombre}) quedó NO CONFORME. "
                  + ("Tiene hallazgos muy graves que deben corregirse de forma inmediata; solicite la segunda visita "
                     "en cuanto estén corregidos." if ce.plazo_dias == 0 else
                     f"Tiene {ce.plazo_dias} días (hasta {ce.fecha_limite_correccion:%d/%m/%Y}) para corregir y "
                     f"solicitar la segunda visita."),
                  "COTIZACION", cot.id_cotizacion, f"/cotizaciones/{cot.id_cotizacion}")
    else:
        notificar(db, usuarios_del_cliente(db, cot.id_cliente) + [cot.asesor],
                  f"Requiere cotización nueva {ce.codigo_servicio}",
                  f"{ce.equipo.identificacion} ({cot.edificio.nombre}) quedó NO CONFORME en la segunda visita "
                  f"({r['no_corregidos']} hallazgo(s) sin corregir). Para certificarlo se debe hacer una nueva "
                  f"primera visita con otra cotización.", "COTIZACION", cot.id_cotizacion,
                  f"/cotizaciones/{cot.id_cotizacion}")
    db.commit()
    return informe_dict(inf)
