# app/routes/catalogos.py
# Catálogos que la app descarga (también para trabajar sin señal): normas, variantes, checklist,
# parámetros, instrumentos de medición. Notificaciones del usuario.

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ChecklistCategoria, ChecklistItem, InstrumentoMedicion, Norma, Notificacion, Parametro, Usuario,
)
from app.routes.cotizaciones import norma_vigente
from app.routes.serializers import fila, norma_dict
from app.security import ADMIN, INSPECTOR, get_current_user, require_roles
from app.services.checklist import tipos_de_variante

router = APIRouter(tags=["Catálogos y notificaciones"])


class ParametroIn(BaseModel):
    valor: str


class InstrumentoIn(BaseModel):
    codigo: str
    tipo: str
    marca: str | None = None
    serial: str | None = None
    id_inspector: int | None = None
    fecha_calibracion: date | None = None
    vence_calibracion: date | None = None
    estado: str = "ACTIVO"


class NormaIn(BaseModel):
    codigo: str = Field(pattern=r"^NTC 5926-[1-9]$")
    parte: int = Field(ge=1, le=9)
    version: int = Field(ge=2000, le=2100)
    nombre: str
    titulo_informe: str
    plazo_dias_leve: int = Field(180, ge=0)
    plazo_dias_grave: int = Field(30, ge=0)
    plazo_dias_muy_grave: int = Field(0, ge=0)
    vigente: bool = False


class NormaUpdate(BaseModel):
    nombre: str | None = None
    titulo_informe: str | None = None
    plazo_dias_leve: int | None = Field(None, ge=0)
    plazo_dias_grave: int | None = Field(None, ge=0)
    plazo_dias_muy_grave: int | None = Field(None, ge=0)
    vigente: bool | None = None
    activo: bool | None = None


# ============================================
# NORMAS (NTC 5926-1:2012 hoy; otras ediciones y partes se agregan aquí)
# ============================================
@router.get("/catalogos/normas")
def normas(solo_activas: bool = True, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    q = db.query(Norma)
    if solo_activas:
        q = q.filter(Norma.activo.is_(True))
    return [norma_dict(n) | {"total_items": db.query(ChecklistItem).filter(ChecklistItem.id_norma == n.id_norma).count()}
            for n in q.order_by(Norma.parte, Norma.version.desc())]


def _marcar_vigente(db: Session, n: Norma):
    """Solo una edición vigente por parte de la norma."""
    for otra in db.query(Norma).filter(Norma.parte == n.parte, Norma.id_norma != n.id_norma, Norma.vigente.is_(True)):
        otra.vigente = False
    db.flush()
    n.vigente = True


@router.post("/catalogos/normas", status_code=201)
def crear_norma(datos: NormaIn, db: Session = Depends(get_db), _: Usuario = Depends(require_roles(ADMIN))):
    if not datos.codigo.endswith(f"-{datos.parte}"):
        raise HTTPException(400, "El código debe corresponder a la parte (ej. NTC 5926-2 para la parte 2)")
    if db.query(Norma).filter(Norma.codigo == datos.codigo, Norma.version == datos.version).first():
        raise HTTPException(409, f"Ya existe {datos.codigo}:{datos.version}")
    n = Norma(**datos.model_dump(exclude={"vigente"}), vigente=False)
    db.add(n)
    db.flush()
    if datos.vigente:
        _marcar_vigente(db, n)
    db.commit()
    return norma_dict(n)


@router.put("/catalogos/normas/{id_norma}")
def actualizar_norma(id_norma: int, datos: NormaUpdate, db: Session = Depends(get_db),
                     _: Usuario = Depends(require_roles(ADMIN))):
    n = db.get(Norma, id_norma)
    if not n:
        raise HTTPException(404, "Norma no encontrada")
    cambios = datos.model_dump(exclude_unset=True)
    vigente = cambios.pop("vigente", None)
    for k, v in cambios.items():
        setattr(n, k, v)
    if vigente is True:
        if not db.query(ChecklistItem).filter(ChecklistItem.id_norma == n.id_norma).first():
            raise HTTPException(409, "No se puede marcar vigente una norma sin checklist cargado")
        _marcar_vigente(db, n)
    elif vigente is False:
        n.vigente = False
    db.commit()
    return norma_dict(n)


# ============================================
# VARIANTES Y CHECKLIST
# ============================================
@router.get("/catalogos/variantes")
def variantes(parte: int = 1, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return [fila(t, ["id_variante_tipo", "codigo", "nombre", "obligatoria"]) |
            {"opciones": [fila(o, ["id_variante_opcion", "codigo", "nombre"]) for o in t.opciones if o.activo]}
            for t in tipos_de_variante(db, parte)]


@router.get("/catalogos/checklist")
def checklist(id_norma: int | None = None, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    """Checklist de una norma (por defecto, la edición vigente de la NTC 5926-1)."""
    norma = db.get(Norma, id_norma) if id_norma else norma_vigente(db, 1)
    if not norma:
        raise HTTPException(404, "Norma no encontrada")
    cats = (db.query(ChecklistCategoria).filter(ChecklistCategoria.id_norma == norma.id_norma,
                                                ChecklistCategoria.activo.is_(True))
            .order_by(ChecklistCategoria.orden).all())
    items = (db.query(ChecklistItem).filter(ChecklistItem.id_norma == norma.id_norma, ChecklistItem.activo.is_(True))
             .order_by(ChecklistItem.orden).all())
    campos = ["id_item", "numero", "codigo", "descripcion", "criterio_cumplimiento", "calificacion",
              "requiere_medicion", "requiere_foto_medicion", "unidad_medida", "plazo_dias"]
    return {"norma": norma_dict(norma),
            "categorias": [fila(c, ["id_categoria", "codigo", "nombre"]) |
                           {"items": [fila(i, campos) for i in items if i.id_categoria == c.id_categoria]}
                           for c in cats]}


# ============================================
# PARÁMETROS
# ============================================
PARAMETROS_NUMERICOS = {"CERTIFICADO_VIGENCIA_MESES", "FOTOS_MAX_POR_EQUIPO", "RECORRIDO_M_POR_PARADA",
                        "RECORRIDO_SOBRE_RECORRIDO_M"}


@router.get("/catalogos/parametros")
def parametros(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return {p.clave: p.valor for p in db.query(Parametro).all()}


@router.put("/catalogos/parametros/{clave}")
def actualizar_parametro(clave: str, datos: ParametroIn, db: Session = Depends(get_db),
                         _: Usuario = Depends(require_roles(ADMIN))):
    p = db.get(Parametro, clave)
    if not p:
        raise HTTPException(404, "Parámetro no encontrado")
    if clave in PARAMETROS_NUMERICOS:
        try:
            if float(datos.valor.replace(",", ".")) < 0:
                raise ValueError
        except ValueError:
            raise HTTPException(400, "El valor debe ser un número mayor o igual a 0 (ej. 2.2)")
        datos.valor = datos.valor.replace(",", ".")
    p.valor = datos.valor
    db.commit()
    return {clave: p.valor}


# ============================================
# INSTRUMENTOS DE MEDICIÓN
# ============================================
@router.get("/instrumentos")
def instrumentos(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    q = db.query(InstrumentoMedicion)
    if usuario.rol_codigo == INSPECTOR:
        q = q.filter(InstrumentoMedicion.estado == "ACTIVO")
    return [fila(i, ["id_instrumento", "codigo", "tipo", "marca", "serial", "id_inspector", "fecha_calibracion",
                     "vence_calibracion", "estado"]) for i in q.order_by(InstrumentoMedicion.tipo, InstrumentoMedicion.codigo)]


@router.post("/instrumentos", status_code=201)
def crear_instrumento(datos: InstrumentoIn, db: Session = Depends(get_db), _: Usuario = Depends(require_roles(ADMIN))):
    if db.query(InstrumentoMedicion).filter(InstrumentoMedicion.codigo == datos.codigo).first():
        raise HTTPException(409, "Ya existe un instrumento con ese código")
    i = InstrumentoMedicion(**datos.model_dump())
    db.add(i)
    db.commit()
    return fila(i, ["id_instrumento", "codigo", "tipo", "id_inspector", "estado"])


# ============================================
# NOTIFICACIONES
# ============================================
@router.get("/notificaciones")
def notificaciones(solo_no_leidas: bool = False, db: Session = Depends(get_db),
                   usuario: Usuario = Depends(get_current_user)):
    q = db.query(Notificacion).filter(Notificacion.id_usuario_destino == usuario.id_usuario)
    if solo_no_leidas:
        q = q.filter(Notificacion.leida.is_(False))
    return [fila(n, ["id_notificacion", "titulo", "mensaje", "tipo", "id_referencia", "enlace", "leida",
                     "fecha_creacion"]) for n in q.order_by(Notificacion.id_notificacion.desc()).limit(100)]


@router.put("/notificaciones/{id_notificacion}/leida")
def marcar_leida(id_notificacion: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    n = db.get(Notificacion, id_notificacion)
    if not n or n.id_usuario_destino != usuario.id_usuario:
        raise HTTPException(404, "Notificación no encontrada")
    n.leida = True
    db.commit()
    return {"ok": True}


@router.put("/notificaciones/leidas")
def marcar_todas_leidas(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    (db.query(Notificacion).filter(Notificacion.id_usuario_destino == usuario.id_usuario, Notificacion.leida.is_(False))
     .update({Notificacion.leida: True}))
    db.commit()
    return {"ok": True}
