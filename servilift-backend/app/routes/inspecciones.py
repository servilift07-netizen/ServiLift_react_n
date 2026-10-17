# app/routes/inspecciones.py
# App móvil del inspector: agenda, abrir informe (datos precargados), variantes,
# checklist según la norma del servicio, fotos, mediciones, firmas y finalizar.
#
# Pensado para trabajar con poca señal: todos los guardados son idempotentes (se pueden reenviar
# sin duplicar) y los resultados del checklist llevan la hora del celular, de modo que un reenvío
# viejo nunca pisa un cambio más reciente.

import json
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ChecklistCategoria, ChecklistItem, CotizacionEquipo, EquipoVariante, Informe, Inspeccion, InspeccionFirma,
    InspeccionFoto, InspeccionInstrumento, InspeccionMedicion, InspeccionResultado, InspeccionVariante,
    InstrumentoMedicion, Programacion, Usuario, VarianteOpcion,
)
from app.routes.serializers import CAMPOS_EDIFICIO, CAMPOS_EQUIPO, cot_equipo_dict, fila, programacion_dict
from app.security import ADMIN, DIRECTOR_TECNICO, INSPECTOR, get_current_user, require_roles, url_archivo
from app.services import archivos
from app.services.checklist import (
    CALIF_CORTA, items_aplicables, pendientes_para_finalizar, pendientes_segunda_visita, precargar_no_aplica,
    resumen,
)
from app.services.flujo import cambiar_estado, notificar, siguiente_numero, usuarios_por_rol
from app.tiempo import a_local, ahora

router = APIRouter(prefix="/inspecciones", tags=["Inspecciones"])

RESULTADOS = {"CUMPLE", "NO_CUMPLE", "NO_APLICA", "NO_VERIFICADO"}
TIPOS_FIRMANTE = {"INSPECTOR", "TECNICO_MANTENIMIENTO", "REPRESENTANTE_EDIFICIO"}


# ============================================
# ESQUEMAS
# ============================================
class IniciarIn(BaseModel):
    id_programacion: int
    id_cotizacion_equipo: int
    uuid_offline: str | None = None
    latitud: float | None = None
    longitud: float | None = None


class EncabezadoIn(BaseModel):
    conservacion_informacion: str | None = None
    tipo_acrilico: str | None = None
    empresa_mantenimiento: str | None = None
    tecnico_mantenimiento: str | None = None
    fecha_ultimo_mantenimiento: date | None = None
    fecha_puesta_marcha: date | None = None
    fecha_ultima_inspeccion: date | None = None
    capacidad_kg: int | None = None
    capacidad_personas: int | None = None
    numero_paradas: int | None = None
    profundidad_foso_mm: int | None = None
    recorrido_m: float | None = None
    observaciones_generales: str | None = None


class EquipoDatosIn(BaseModel):
    """Datos del ascensor que el inspector verifica en sitio."""
    tipo_equipo: str | None = None
    marca: str | None = None
    modelo: str | None = None
    numero_serie: str | None = None
    anio_fabricacion: int | None = None
    capacidad_kg: int | None = None
    capacidad_personas: int | None = None
    numero_paradas: int | None = None
    velocidad_ms: float | None = None
    recorrido_m: float | None = None
    profundidad_foso_mm: int | None = None
    fecha_puesta_marcha: date | None = None


# Campos que además quedan en la inspección (encabezado del informe)
CAMPOS_EQUIPO_EN_INSPECCION = ("capacidad_kg", "capacidad_personas", "numero_paradas", "profundidad_foso_mm",
                               "recorrido_m", "fecha_puesta_marcha")


class VarianteIn(BaseModel):
    id_variante_tipo: int
    id_variante_opcion: int


class ResultadoIn(BaseModel):
    id_item: int
    resultado: str
    valor_medido: str | None = None
    unidad_medida: str | None = None
    observacion: str | None = None
    modificado_en: datetime | None = None   # hora del celular en que se hizo el cambio


class SegundaVisitaIn(BaseModel):
    id_item: int
    estado_segunda_visita: str          # CORREGIDO / NO_CORREGIDO
    observacion_segunda_visita: str | None = None
    modificado_en: datetime | None = None


class FotoUpdate(BaseModel):
    descripcion: str | None = None
    orden: int | None = None
    incluir_en_informe: bool | None = None
    revisada: bool | None = None
    id_item: int | None = None


class FirmaIn(BaseModel):
    tipo_firmante: str
    nombre: str
    documento: str | None = None
    cargo: str | None = None
    empresa: str | None = None
    firma_base64: str | None = None     # imagen PNG/JPG en base64, o
    dibujo: dict | None = None          # trazos dibujados en la app: {ancho, alto, trazos: [[[x, y], ...], ...]}
    numero_visita: int = 1
    uuid_offline: str | None = None
    fecha_firma: datetime | None = None


class MedicionIn(BaseModel):
    concepto: str
    valor: Decimal | None = None
    unidad: str | None = None
    resultado: str | None = None
    detalle: str | None = None
    id_item: int | None = None


# ============================================
# ACCESO
# ============================================
def _obtener(db: Session, id_inspeccion: int, usuario: Usuario) -> Inspeccion:
    insp = db.get(Inspeccion, id_inspeccion)
    if not insp:
        raise HTTPException(404, "Inspección no encontrada")
    if usuario.rol_codigo == INSPECTOR and usuario.id_usuario not in (insp.id_inspector, insp.id_inspector_visita2):
        raise HTTPException(403, "Esta inspección no está asignada a usted")
    if usuario.rol_codigo not in (INSPECTOR, DIRECTOR_TECNICO, ADMIN):
        raise HTTPException(403, "No tiene permisos para ver inspecciones")
    return insp


def _editable(insp: Inspeccion, usuario: Usuario, primera_visita: bool = False):
    """El inspector edita mientras está en curso, devuelta o en segunda visita; el director mientras revisa.
    primera_visita=True: solo lo que se diligencia en la primera visita (checklist, variantes)."""
    estados = ("EN_CURSO", "DEVUELTA") if primera_visita else ("EN_CURSO", "DEVUELTA", "EN_SEGUNDA_VISITA")
    if usuario.rol_codigo == INSPECTOR and insp.estado in estados:
        return
    inf = insp.informe()
    if usuario.rol_codigo in (DIRECTOR_TECNICO, ADMIN) and inf and inf.estado == "PENDIENTE_REVISION" \
            and (not primera_visita or inf.numero_visita == 1):
        return
    raise HTTPException(409, f"La inspección está {insp.estado} y no se puede modificar")


# ============================================
# SERIALIZACIÓN
# ============================================
def foto_dict(f: InspeccionFoto):
    d = fila(f, ["id_foto", "id_resultado", "numero_visita", "uuid_offline", "nombre_archivo", "descripcion", "orden",
                 "incluir_en_informe", "revisada", "fecha_captura", "tamano_kb"])
    d["url"] = url_archivo(f.ruta_archivo)
    d["url_miniatura"] = url_archivo(f.ruta_miniatura or f.ruta_archivo)
    return d


def _informe_corto(inf: Informe | None):
    if not inf:
        return None
    return fila(inf, ["id_informe", "numero_informe", "numero_visita", "estado", "concepto", "observaciones_revision",
                      "fecha_aprobacion"])


def _detalle(db: Session, insp: Inspeccion) -> dict:
    d = fila(insp, ["id_inspeccion", "numero_inspeccion", "id_cotizacion_equipo", "id_norma", "id_programacion",
                    "id_inspector", "conservacion_informacion", "tipo_acrilico", "empresa_mantenimiento",
                    "tecnico_mantenimiento", "fecha_ultimo_mantenimiento", "fecha_puesta_marcha",
                    "fecha_ultima_inspeccion", "capacidad_kg", "capacidad_personas", "numero_paradas",
                    "profundidad_foso_mm", "recorrido_m", "fecha_inicio", "fecha_fin", "id_programacion_visita2",
                    "id_inspector_visita2", "fecha_inicio_visita2", "fecha_fin_visita2", "estado",
                    "observaciones_generales", "uuid_offline"])
    d["norma"] = insp.norma.etiqueta
    d["parte_norma"] = insp.norma.parte
    d["inspector"] = insp.inspector.nombre_completo
    d["inspector_visita2"] = insp.inspector_visita2.nombre_completo if insp.inspector_visita2 else None
    d["numero_visita"] = insp.visita_actual
    d["datos_equipo"] = json.loads(insp.datos_equipo_json or "{}")
    d["variantes"] = [{"id_variante_tipo": v.id_variante_tipo, "tipo": v.tipo.nombre, "codigo_tipo": v.tipo.codigo,
                       "id_variante_opcion": v.id_variante_opcion, "opcion": v.opcion.nombre,
                       "codigo_opcion": v.opcion.codigo} for v in insp.variantes]
    d["resumen"] = resumen(insp)
    d["total_fotos"] = len(insp.fotos)
    d["firmas"] = [fila(f, ["id_firma", "numero_visita", "tipo_firmante", "nombre", "documento", "cargo", "empresa",
                            "fecha_firma", "uuid_offline"]) | {"url": url_archivo(f.ruta_firma)} for f in insp.firmas]
    d["mediciones"] = [fila(m, ["id_medicion", "id_item", "concepto", "valor", "unidad", "resultado", "detalle"])
                       for m in insp.mediciones]
    d["instrumentos"] = [fila(i.instrumento, ["id_instrumento", "codigo", "tipo", "vence_calibracion"])
                         for i in insp.instrumentos]
    d["informe"] = _informe_corto(insp.informe())            # el de la visita actual
    d["informes"] = [_informe_corto(i) for i in insp.informes]  # 1ª y, si existe, 2ª visita
    return d


# ============================================
# AGENDA DEL INSPECTOR
# ============================================
@router.get("/agenda")
def agenda(desde: date | None = None, db: Session = Depends(get_db),
           usuario: Usuario = Depends(require_roles(INSPECTOR))):
    # Visitas abiertas + las que tienen una inspección devuelta por el director o en segunda visita
    con_pendientes = {i.id_programacion_visita2 if i.estado == "EN_SEGUNDA_VISITA" or i.id_programacion_visita2
                      else i.id_programacion
                      for i in db.query(Inspeccion).filter(
                          or_(Inspeccion.id_inspector == usuario.id_usuario,
                              Inspeccion.id_inspector_visita2 == usuario.id_usuario),
                          Inspeccion.estado.in_(("DEVUELTA", "EN_CURSO", "EN_SEGUNDA_VISITA")))}
    q = db.query(Programacion).filter(
        Programacion.id_inspector == usuario.id_usuario,
        or_(Programacion.estado.in_(("PROGRAMADA", "REPROGRAMADA", "EN_CURSO")),
            Programacion.id_programacion.in_(con_pendientes or {0})))
    if desde:
        q = q.filter(Programacion.fecha_programada >= desde)
    salida = []
    for p in q.order_by(Programacion.fecha_programada, Programacion.hora_inicio):
        d = programacion_dict(p)
        for eq in d["equipos"]:
            insp = (db.query(Inspeccion).filter(Inspeccion.id_cotizacion_equipo == eq["id_cotizacion_equipo"])
                    .order_by(Inspeccion.id_inspeccion.desc()).first())
            eq["inspeccion"] = ({"id_inspeccion": insp.id_inspeccion, "estado": insp.estado,
                                 "numero_visita": insp.visita_actual} if insp else None)
        salida.append(d)
    return salida


@router.get("")
def listar(estado: str | None = None, numero_cotizacion: str | None = None, db: Session = Depends(get_db),
           usuario: Usuario = Depends(require_roles(INSPECTOR, DIRECTOR_TECNICO))):
    q = db.query(Inspeccion)
    if usuario.rol_codigo == INSPECTOR:
        q = q.filter(or_(Inspeccion.id_inspector == usuario.id_usuario,
                         Inspeccion.id_inspector_visita2 == usuario.id_usuario))
    if estado:
        q = q.filter(Inspeccion.estado == estado)
    if numero_cotizacion:
        q = q.join(CotizacionEquipo).filter(CotizacionEquipo.codigo_servicio.like(f"{numero_cotizacion.strip()}%"))
    salida = []
    for i in q.order_by(Inspeccion.id_inspeccion.desc()).all():
        d = fila(i, ["id_inspeccion", "numero_inspeccion", "estado", "fecha_inicio", "fecha_fin"])
        d["numero_visita"] = i.visita_actual
        d["servicio"] = cot_equipo_dict(i.cotizacion_equipo)
        d["inspector"] = i.inspector.nombre_completo
        salida.append(d)
    return salida


# ============================================
# ABRIR EL INFORME
# ============================================
@router.post("/iniciar", status_code=201)
def iniciar(datos: IniciarIn, db: Session = Depends(get_db), usuario: Usuario = Depends(require_roles(INSPECTOR))):
    if datos.uuid_offline:
        previa = db.query(Inspeccion).filter(Inspeccion.uuid_offline == datos.uuid_offline).first()
        if previa:
            return _detalle(db, previa)  # reintento desde el celular: idempotente
    p = db.get(Programacion, datos.id_programacion)
    if not p or p.id_inspector != usuario.id_usuario or p.estado == "CANCELADA":
        raise HTTPException(404, "Visita no encontrada en su agenda")
    if datos.id_cotizacion_equipo not in {pe.id_cotizacion_equipo for pe in p.equipos}:
        raise HTTPException(400, "El equipo no hace parte de esta visita")
    ce = db.get(CotizacionEquipo, datos.id_cotizacion_equipo)
    if p.tipo_visita == "SEGUNDA":
        return _iniciar_segunda_visita(db, p, ce, usuario)
    # Un servicio tiene una sola primera visita: si ya existe (en curso, devuelta o finalizada) se abre esa
    existente = db.query(Inspeccion).filter(Inspeccion.id_cotizacion_equipo == ce.id_cotizacion_equipo).first()
    if existente:
        return _detalle(db, existente)

    cot, eq = ce.cotizacion, ce.equipo
    ed, cl = cot.edificio, cot.cliente
    # Copia de los datos tal como estaban al abrir el informe (el informe no cambia si luego editan el cliente)
    snapshot = {
        "numero_cotizacion": cot.numero_cotizacion, "codigo_servicio": ce.codigo_servicio,
        "tipo_servicio": ce.tipo_servicio, "norma": ce.norma.etiqueta,
        "cliente": {"razon_social": cl.razon_social, "tipo_documento": cl.tipo_documento,
                    "numero_documento": cl.numero_documento, "contacto": cl.contacto_nombre},
        "edificio": fila(ed, CAMPOS_EDIFICIO),
        "equipo": fila(eq, CAMPOS_EQUIPO),
    }
    anterior = (db.query(Inspeccion).join(CotizacionEquipo)
                .filter(CotizacionEquipo.id_equipo == eq.id_equipo, Inspeccion.estado.in_(("APROBADA", "CERRADA")))
                .order_by(Inspeccion.fecha_inicio.desc()).first())
    insp = Inspeccion(
        numero_inspeccion=siguiente_numero(db, "INS"), id_cotizacion_equipo=ce.id_cotizacion_equipo,
        id_norma=ce.id_norma, id_programacion=p.id_programacion, id_inspector=usuario.id_usuario,
        uuid_offline=datos.uuid_offline, datos_equipo_json=json.dumps(snapshot, ensure_ascii=False),
        fecha_inicio=ahora(), empresa_mantenimiento=ed.empresa_mantenimiento,
        fecha_puesta_marcha=eq.fecha_puesta_marcha,
        fecha_ultima_inspeccion=anterior.fecha_inicio.date() if anterior else None,
        capacidad_kg=eq.capacidad_kg, capacidad_personas=eq.capacidad_personas, numero_paradas=eq.numero_paradas,
        profundidad_foso_mm=eq.profundidad_foso_mm, recorrido_m=eq.recorrido_m,
        latitud=datos.latitud, longitud=datos.longitud, estado="EN_CURSO",
    )
    db.add(insp)
    db.flush()
    # Variantes conocidas del equipo (de la misma parte de la norma) e instrumentos del inspector se precargan
    for v in eq.variantes:
        insp.variantes.append(InspeccionVariante(id_variante_tipo=v.id_variante_tipo, id_variante_opcion=v.id_variante_opcion))
    for ins in db.query(InstrumentoMedicion).filter(InstrumentoMedicion.id_inspector == usuario.id_usuario,
                                                    InstrumentoMedicion.estado == "ACTIVO"):
        insp.instrumentos.append(InspeccionInstrumento(id_instrumento=ins.id_instrumento))
    precargar_no_aplica(db, insp)  # por variantes del equipo y por su foso
    cambiar_estado(db, ce, "EN_INSPECCION", usuario)
    p.estado = "EN_CURSO"
    db.commit()
    db.refresh(insp)
    return _detalle(db, insp)


def _iniciar_segunda_visita(db: Session, p: Programacion, ce: CotizacionEquipo, usuario: Usuario):
    insp = (db.query(Inspeccion).filter(Inspeccion.id_cotizacion_equipo == ce.id_cotizacion_equipo)
            .order_by(Inspeccion.id_inspeccion.desc()).first())
    if insp and insp.estado == "EN_SEGUNDA_VISITA" and insp.id_programacion_visita2 == p.id_programacion:
        return _detalle(db, insp)
    inf1 = insp.informe(1) if insp else None
    if not insp or insp.estado != "APROBADA" or not inf1 or inf1.estado != "APROBADO" or inf1.concepto != "NO_CONFORME":
        raise HTTPException(409, "El equipo no tiene un informe de primera visita no conforme pendiente de segunda visita")
    if insp.informe(2):
        raise HTTPException(409, "Este servicio ya tuvo su segunda visita: solo existen dos visitas por servicio")
    insp.estado = "EN_SEGUNDA_VISITA"
    insp.id_programacion_visita2, insp.id_inspector_visita2 = p.id_programacion, usuario.id_usuario
    insp.fecha_inicio_visita2 = ahora()
    # Si una segunda visita anterior se canceló a medias, sus firmas no sirven
    for f in [f for f in insp.firmas if f.numero_visita == 2]:
        insp.firmas.remove(f)
    cambiar_estado(db, ce, "EN_INSPECCION", usuario, "Segunda visita (cierre de hallazgos)")
    p.estado = "EN_CURSO"
    db.commit()
    db.refresh(insp)
    return _detalle(db, insp)


@router.get("/{id_inspeccion}")
def obtener(id_inspeccion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    return _detalle(db, _obtener(db, id_inspeccion, usuario))


@router.put("/{id_inspeccion}/encabezado")
def encabezado(id_inspeccion: int, datos: EncabezadoIn, db: Session = Depends(get_db),
               usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(insp, k, v)
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return _detalle(db, insp)


@router.put("/{id_inspeccion}/equipo")
def datos_equipo(id_inspeccion: int, datos: EquipoDatosIn, db: Session = Depends(get_db),
                 usuario: Usuario = Depends(get_current_user)):
    """El inspector registra/corrige los datos del ascensor: quedan en el equipo (para próximas
    inspecciones) y en la copia del informe."""
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario, primera_visita=True)
    equipo = insp.cotizacion_equipo.equipo
    cambios = datos.model_dump(exclude_unset=True)
    for k, v in cambios.items():
        setattr(equipo, k, v)
        if k in CAMPOS_EQUIPO_EN_INSPECCION:
            setattr(insp, k, v)
    db.flush()
    snapshot = json.loads(insp.datos_equipo_json or "{}")
    snapshot["equipo"] = fila(equipo, CAMPOS_EQUIPO)
    insp.datos_equipo_json = json.dumps(snapshot, ensure_ascii=False)
    precargar_no_aplica(db, insp)  # la profundidad de foso decide si aplican algunos ítems
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return _detalle(db, insp)


# ============================================
# VARIANTES (tracción / hidráulico, enhebrado, máquina...)
# ============================================
@router.put("/{id_inspeccion}/variantes")
def variantes(id_inspeccion: int, datos: list[VarianteIn], db: Session = Depends(get_db),
              usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario, primera_visita=True)
    actuales = {v.id_variante_tipo: v for v in insp.variantes}
    equipo = insp.cotizacion_equipo.equipo
    del_equipo = {v.id_variante_tipo: v for v in equipo.variantes}
    for v in datos:
        op = db.get(VarianteOpcion, v.id_variante_opcion)
        if not op or op.id_variante_tipo != v.id_variante_tipo:
            raise HTTPException(400, f"Opción {v.id_variante_opcion} no válida para la variante {v.id_variante_tipo}")
        if v.id_variante_tipo in actuales:
            actuales[v.id_variante_tipo].id_variante_opcion = v.id_variante_opcion
        else:
            insp.variantes.append(InspeccionVariante(**v.model_dump()))
        # El equipo recuerda sus variantes para la próxima inspección
        if v.id_variante_tipo in del_equipo:
            del_equipo[v.id_variante_tipo].id_variante_opcion = v.id_variante_opcion
        else:
            equipo.variantes.append(EquipoVariante(**v.model_dump()))
    precargar_no_aplica(db, insp)
    insp.fecha_sincronizacion = ahora()
    db.commit()
    db.refresh(insp)
    return _detalle(db, insp)


# ============================================
# CHECKLIST (el de la norma del servicio)
# ============================================
@router.get("/{id_inspeccion}/checklist")
def checklist(id_inspeccion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    # Inspecciones abiertas antes de las reglas, o con ítems sin calificar que no aplican: quedan en N/A
    if insp.estado in ("EN_CURSO", "DEVUELTA") and precargar_no_aplica(db, insp):
        db.commit()
    aplica = items_aplicables(db, insp.id_inspeccion)
    res = {r.id_item: r for r in insp.resultados}
    fotos_por_res = {}
    for f in insp.fotos:
        if f.id_resultado:
            fotos_por_res.setdefault(f.id_resultado, []).append(foto_dict(f))
    items_por_cat = {}
    for it in (db.query(ChecklistItem).filter(ChecklistItem.id_norma == insp.id_norma, ChecklistItem.activo.is_(True))
               .order_by(ChecklistItem.orden)):
        items_por_cat.setdefault(it.id_categoria, []).append(it)
    categorias = []
    for cat in (db.query(ChecklistCategoria).filter(ChecklistCategoria.id_norma == insp.id_norma,
                                                    ChecklistCategoria.activo.is_(True))
                .order_by(ChecklistCategoria.orden)):
        lista = []
        for it in items_por_cat.get(cat.id_categoria, []):
            r = res.get(it.id_item)
            lista.append({
                "id_item": it.id_item, "numero": it.numero, "codigo": it.codigo, "descripcion": it.descripcion,
                "criterio_cumplimiento": it.criterio_cumplimiento, "calificacion": it.calificacion,
                "calificacion_corta": CALIF_CORTA[it.calificacion], "requiere_medicion": it.requiere_medicion,
                "requiere_foto_medicion": it.requiere_foto_medicion, "unidad_medida": it.unidad_medida,
                "aplica": aplica.get(it.id_item, True),
                "resultado": fila(r, ["id_resultado", "resultado", "calificacion_defecto", "no_aplica_automatico",
                                      "valor_medido", "unidad_medida", "observacion", "hallazgo_director",
                                      "estado_segunda_visita", "observacion_segunda_visita",
                                      "modificado_en_cliente"]) if r else None,
                "fotos": fotos_por_res.get(r.id_resultado, []) if r else [],
            })
        categorias.append({"id_categoria": cat.id_categoria, "codigo": cat.codigo, "nombre": cat.nombre,
                           "total": len(lista), "calificados": sum(1 for x in lista if x["resultado"]),
                           "items": lista})
    return {"id_inspeccion": insp.id_inspeccion, "norma": insp.norma.etiqueta, "numero_visita": insp.visita_actual,
            "resumen": resumen(insp), "categorias": categorias}


def _es_mas_viejo(r: InspeccionResultado, modificado_en: datetime | None) -> bool:
    """True si el cambio que llega es anterior al que ya está guardado (reenvío atrasado desde el celular)."""
    if modificado_en is None or r.modificado_en_cliente is None:
        return False
    return a_local(modificado_en) < r.modificado_en_cliente


@router.put("/{id_inspeccion}/resultados")
def guardar_resultados(id_inspeccion: int, datos: list[ResultadoIn], db: Session = Depends(get_db),
                       usuario: Usuario = Depends(get_current_user)):
    """Guarda en lote (sirve para sincronizar lo que el celular llenó sin señal). Idempotente:
    reenviar el mismo lote no cambia nada, y un cambio más viejo que el guardado se ignora."""
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario, primera_visita=True)
    items = {i.id_item: i for i in db.query(ChecklistItem).filter(ChecklistItem.id_item.in_([d.id_item for d in datos]),
                                                                   ChecklistItem.id_norma == insp.id_norma)}
    res = {r.id_item: r for r in insp.resultados}
    es_director = usuario.rol_codigo in (DIRECTOR_TECNICO, ADMIN)
    omitidos = 0
    for d in datos:
        it = items.get(d.id_item)
        if not it:
            raise HTTPException(400, f"El ítem {d.id_item} no pertenece al checklist de la norma {insp.norma.etiqueta}")
        if d.resultado not in RESULTADOS:
            raise HTTPException(400, f"Resultado inválido: {d.resultado}")
        r = res.get(d.id_item)
        if r is None:
            r = InspeccionResultado(id_item=d.id_item)
            insp.resultados.append(r)
            res[d.id_item] = r
        elif _es_mas_viejo(r, d.modificado_en):
            omitidos += 1
            continue
        if es_director and r.resultado != d.resultado and d.resultado == "NO_CUMPLE":
            r.hallazgo_director = True
        r.resultado = d.resultado
        r.calificacion_defecto = it.calificacion if d.resultado == "NO_CUMPLE" else None
        r.no_aplica_automatico = False
        r.valor_medido, r.unidad_medida, r.observacion = d.valor_medido, d.unidad_medida, d.observacion
        r.modificado_en_cliente = a_local(d.modificado_en) or ahora()
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return {"guardados": len(datos) - omitidos, "omitidos_por_antiguos": omitidos, "resumen": resumen(insp)}


@router.put("/{id_inspeccion}/segunda-visita")
def guardar_segunda_visita(id_inspeccion: int, datos: list[SegundaVisitaIn], db: Session = Depends(get_db),
                           usuario: Usuario = Depends(get_current_user)):
    """Cierre de hallazgos: cada ítem NO CUMPLE se marca CORREGIDO o NO_CORREGIDO."""
    insp = _obtener(db, id_inspeccion, usuario)
    inf2 = insp.informe(2)
    director_revisando = (usuario.rol_codigo in (DIRECTOR_TECNICO, ADMIN) and inf2
                          and inf2.estado == "PENDIENTE_REVISION")
    if insp.estado != "EN_SEGUNDA_VISITA" and not director_revisando:
        raise HTTPException(409, "La inspección no está en segunda visita")
    res = {r.id_item: r for r in insp.resultados}
    omitidos = 0
    for d in datos:
        r = res.get(d.id_item)
        if not r or r.resultado != "NO_CUMPLE":
            raise HTTPException(400, f"El ítem {d.id_item} no es un hallazgo (NO CUMPLE) de esta inspección")
        if d.estado_segunda_visita not in ("CORREGIDO", "NO_CORREGIDO"):
            raise HTTPException(400, "estado_segunda_visita debe ser CORREGIDO o NO_CORREGIDO")
        if _es_mas_viejo(r, d.modificado_en):
            omitidos += 1
            continue
        r.estado_segunda_visita, r.observacion_segunda_visita = d.estado_segunda_visita, d.observacion_segunda_visita
        r.modificado_en_cliente = a_local(d.modificado_en) or ahora()
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return {"guardados": len(datos) - omitidos, "omitidos_por_antiguos": omitidos, "resumen": resumen(insp)}


# ============================================
# FOTOS (álbum de ~100 por equipo; cada foto queda marcada con su visita)
# ============================================
@router.post("/{id_inspeccion}/fotos", status_code=201)
def subir_fotos(id_inspeccion: int, archivos_foto: list[UploadFile] = File(..., alias="archivos"),
                id_item: int | None = Form(None), descripcion: str | None = Form(None),
                uuid_offline: str | None = Form(None), fecha_captura: datetime | None = Form(None),
                latitud: float | None = Form(None), longitud: float | None = Form(None),
                db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    if uuid_offline and len(archivos_foto) == 1:
        previa = db.query(InspeccionFoto).filter(InspeccionFoto.uuid_offline == uuid_offline).first()
        if previa:
            return [foto_dict(previa)]  # reintento: la foto ya llegó
    id_resultado = None
    if id_item:
        r = next((x for x in insp.resultados if x.id_item == id_item), None)
        if r is None:
            r = InspeccionResultado(id_item=id_item, resultado="NO_VERIFICADO")
            insp.resultados.append(r)
            db.flush()
        id_resultado = r.id_resultado
    orden = max((f.orden for f in insp.fotos), default=0)
    nuevas = []
    for a in archivos_foto:
        orden += 1
        info = archivos.guardar_foto(insp.id_inspeccion, a)
        f = InspeccionFoto(id_resultado=id_resultado, descripcion=descripcion, orden=orden,
                           numero_visita=insp.visita_actual,
                           uuid_offline=uuid_offline if len(archivos_foto) == 1 else None,
                           fecha_captura=a_local(fecha_captura) or ahora(), latitud=latitud, longitud=longitud,
                           **info)
        insp.fotos.append(f)
        nuevas.append(f)
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return [foto_dict(f) for f in nuevas]


@router.get("/{id_inspeccion}/fotos")
def listar_fotos(id_inspeccion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    return [foto_dict(f) for f in _obtener(db, id_inspeccion, usuario).fotos]


@router.put("/{id_inspeccion}/fotos/{id_foto}")
def actualizar_foto(id_inspeccion: int, id_foto: int, datos: FotoUpdate, db: Session = Depends(get_db),
                    usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    f = next((x for x in insp.fotos if x.id_foto == id_foto), None)
    if not f:
        raise HTTPException(404, "Foto no encontrada")
    cambios = datos.model_dump(exclude_unset=True)
    if "id_item" in cambios:
        id_item = cambios.pop("id_item")
        r = next((x for x in insp.resultados if x.id_item == id_item), None) if id_item else None
        f.id_resultado = r.id_resultado if r else None
    for k, v in cambios.items():
        setattr(f, k, v)
    db.commit()
    return foto_dict(f)


@router.delete("/{id_inspeccion}/fotos/{id_foto}", status_code=204)
def borrar_foto(id_inspeccion: int, id_foto: int, db: Session = Depends(get_db),
                usuario: Usuario = Depends(require_roles(INSPECTOR))):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    f = next((x for x in insp.fotos if x.id_foto == id_foto), None)
    if not f:
        return  # ya estaba borrada: el reintento no falla
    if f.numero_visita != insp.visita_actual:
        raise HTTPException(409, "Las fotos de la primera visita no se pueden borrar durante la segunda")
    archivos.borrar(f.ruta_archivo)
    archivos.borrar(f.ruta_miniatura)
    insp.fotos.remove(f)
    db.commit()


# ============================================
# INSTRUMENTOS Y MEDICIONES
# ============================================
@router.put("/{id_inspeccion}/instrumentos")
def instrumentos(id_inspeccion: int, ids_instrumento: list[int], db: Session = Depends(get_db),
                 usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    validos = {i.id_instrumento for i in db.query(InstrumentoMedicion).filter(InstrumentoMedicion.id_instrumento.in_(ids_instrumento))}
    insp.instrumentos.clear()
    db.flush()
    for i in dict.fromkeys(ids_instrumento):
        if i not in validos:
            raise HTTPException(400, f"Instrumento {i} no existe")
        insp.instrumentos.append(InspeccionInstrumento(id_instrumento=i))
    db.commit()
    return _detalle(db, insp)


@router.put("/{id_inspeccion}/mediciones")
def mediciones(id_inspeccion: int, datos: list[MedicionIn], db: Session = Depends(get_db),
               usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    _editable(insp, usuario)
    insp.mediciones.clear()
    db.flush()
    for m in datos:
        insp.mediciones.append(InspeccionMedicion(**m.model_dump()))
    db.commit()
    return _detalle(db, insp)


# ============================================
# FIRMAS: inspector, técnico de mantenimiento y representante del edificio (por visita)
# ============================================
@router.post("/{id_inspeccion}/firmas", status_code=201)
def firmar(id_inspeccion: int, datos: FirmaIn, db: Session = Depends(get_db),
           usuario: Usuario = Depends(require_roles(INSPECTOR))):
    insp = _obtener(db, id_inspeccion, usuario)
    if datos.uuid_offline and db.query(InspeccionFirma).filter(InspeccionFirma.uuid_offline == datos.uuid_offline).first():
        return _detalle(db, insp)  # reintento: la firma ya llegó
    if datos.numero_visita not in (1, 2):
        raise HTTPException(400, "Solo existen la primera y la segunda visita")
    permitido = insp.estado in ("EN_CURSO", "DEVUELTA") if datos.numero_visita == 1 else insp.estado == "EN_SEGUNDA_VISITA"
    if not permitido:
        raise HTTPException(409, f"La inspección está {insp.estado}; no se puede firmar la visita {datos.numero_visita}")
    if datos.tipo_firmante not in TIPOS_FIRMANTE:
        raise HTTPException(400, f"Tipo de firmante inválido: {datos.tipo_firmante}")
    ruta = archivos.guardar_firma(f"inspecciones/{insp.id_inspeccion}/firmas", datos.firma_base64, datos.dibujo)
    previa = next((f for f in insp.firmas if f.tipo_firmante == datos.tipo_firmante
                   and f.numero_visita == datos.numero_visita), None)
    if previa:
        archivos.borrar(previa.ruta_firma)
        insp.firmas.remove(previa)
        db.flush()
    nombre, documento, cargo = datos.nombre, datos.documento, datos.cargo
    if datos.tipo_firmante == "INSPECTOR":  # el documento siempre es el del usuario inspector
        nombre = nombre or usuario.nombre_completo
        documento = " ".join(x for x in (usuario.tipo_documento, usuario.documento) if x) or None
        cargo = cargo or "Inspector"
    elif datos.tipo_firmante == "TECNICO_MANTENIMIENTO":  # sin documento; el cargo lo escribe quien firma
        documento, cargo = None, cargo or "Técnico de mantenimiento"
    insp.firmas.append(InspeccionFirma(
        numero_visita=datos.numero_visita, tipo_firmante=datos.tipo_firmante, uuid_offline=datos.uuid_offline,
        id_usuario=usuario.id_usuario if datos.tipo_firmante == "INSPECTOR" else None,
        nombre=nombre, documento=documento, cargo=cargo, empresa=datos.empresa,
        ruta_firma=ruta, fecha_firma=a_local(datos.fecha_firma) or ahora(),
    ))
    if datos.tipo_firmante == "TECNICO_MANTENIMIENTO" and not insp.tecnico_mantenimiento:
        insp.tecnico_mantenimiento = datos.nombre
    insp.fecha_sincronizacion = ahora()
    db.commit()
    return _detalle(db, insp)


# ============================================
# FINALIZAR -> el informe de la visita pasa al director técnico
# ============================================
@router.get("/{id_inspeccion}/validar")
def validar(id_inspeccion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    insp = _obtener(db, id_inspeccion, usuario)
    errores = (pendientes_segunda_visita(insp) if insp.estado == "EN_SEGUNDA_VISITA"
               else pendientes_para_finalizar(db, insp))
    return {"puede_finalizar": not errores, "pendientes": errores}


def _numero_informe(db: Session, insp: Inspeccion, numero_visita: int) -> str:
    """INF-AAAA-NNNN-1V para la primera visita; la segunda reutiliza el mismo número con -2V."""
    if numero_visita == 1:
        return f"{siguiente_numero(db, 'INF')}-1V"
    return insp.informe(1).numero_informe[:-3] + "-2V"


def _enviar_a_revision(db: Session, insp: Inspeccion, numero_visita: int) -> Informe:
    inf = insp.informe(numero_visita)
    if inf:
        inf.estado = "PENDIENTE_REVISION"   # vuelve después de una devolución
    else:
        inf = Informe(numero_informe=_numero_informe(db, insp, numero_visita), id_inspeccion=insp.id_inspeccion,
                      numero_visita=numero_visita, estado="PENDIENTE_REVISION")
        db.add(inf)
        insp.informes.append(inf)
    return inf


@router.post("/{id_inspeccion}/finalizar")
def finalizar(id_inspeccion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(require_roles(INSPECTOR))):
    insp = _obtener(db, id_inspeccion, usuario)
    if insp.estado == "EN_SEGUNDA_VISITA":
        return _finalizar_segunda_visita(db, insp, usuario)
    if insp.estado not in ("EN_CURSO", "DEVUELTA"):
        if insp.estado == "FINALIZADA":
            return _detalle(db, insp)  # reintento: ya estaba finalizada
        raise HTTPException(409, f"La inspección ya está {insp.estado}")
    errores = pendientes_para_finalizar(db, insp)
    if errores:
        raise HTTPException(422, {"mensaje": "La inspección tiene pendientes", "pendientes": errores})

    insp.estado, insp.fecha_fin = "FINALIZADA", ahora()
    inf = _enviar_a_revision(db, insp, 1)
    cambiar_estado(db, insp.cotizacion_equipo, "EN_REVISION", usuario)
    p = insp.programacion
    if all(pe.cotizacion_equipo.estado not in ("PROGRAMADO", "EN_INSPECCION") for pe in p.equipos):
        p.estado = "REALIZADA"
    ce = insp.cotizacion_equipo
    db.flush()
    notificar(db, usuarios_por_rol(db, DIRECTOR_TECNICO), f"Informe por revisar {inf.numero_informe}",
              f"{insp.inspector.nombre_completo} finalizó la primera visita de {ce.equipo.identificacion} "
              f"en {ce.cotizacion.edificio.nombre}.", "INFORME", inf.id_informe, f"/informes/{inf.id_informe}")
    db.commit()
    db.refresh(insp)
    return _detalle(db, insp)


def _finalizar_segunda_visita(db: Session, insp: Inspeccion, usuario: Usuario):
    errores = pendientes_segunda_visita(insp)
    if errores:
        raise HTTPException(422, {"mensaje": "La segunda visita tiene pendientes", "pendientes": errores})
    insp.estado, insp.fecha_fin_visita2 = "FINALIZADA", ahora()
    inf = _enviar_a_revision(db, insp, 2)
    ce = insp.cotizacion_equipo
    cambiar_estado(db, ce, "EN_REVISION", usuario, "Segunda visita finalizada")
    p2 = insp.programacion_visita2
    if all(pe.cotizacion_equipo.estado not in ("PROGRAMADO", "EN_INSPECCION") for pe in p2.equipos):
        p2.estado = "REALIZADA"
    r = resumen(insp)
    db.flush()
    notificar(db, usuarios_por_rol(db, DIRECTOR_TECNICO), f"Informe de 2ª visita por revisar {inf.numero_informe}",
              f"{usuario.nombre_completo} cerró la segunda visita de {ce.equipo.identificacion}: "
              f"{r['corregidos']} corregidos, {r['no_corregidos']} no corregidos.", "INFORME",
              inf.id_informe, f"/informes/{inf.id_informe}")
    db.commit()
    db.refresh(insp)
    return _detalle(db, insp)
