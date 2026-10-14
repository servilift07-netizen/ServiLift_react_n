"""Exporta a contenido.json todo lo que el documento Word toma del código: diccionario de datos, áreas,
casos de uso, roles, permisos por rol, endpoints y tamaños de las imágenes."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from PIL import Image  # noqa: E402

import casos  # noqa: E402
import endpoints  # noqa: E402
import er  # noqa: E402
from modulos import MODULOS  # noqa: E402

AQUI = Path(__file__).resolve().parent
IMG = AQUI.parent / "img"

DESC_TABLA = {
    "rol": "Los siete roles del sistema: ADMIN, ASESOR, CLIENTE, PROGRAMACION, INSPECTOR, DIRECTOR_TECNICO y CERTIFICADOS.",
    "usuario": "Usuarios internos y usuarios del portal del cliente. La contraseña se guarda como BLOB (sal más PBKDF2-SHA256).",
    "notificacion": "Avisos para cada usuario, con el enlace a la pantalla de la app que los atiende.",
    "parametro": "Datos de la empresa y valores editables del informe, como los metros por parada y el sobre recorrido.",
    "consecutivo": "Último número usado por prefijo (COT, INS, INF, CER) y año; se bloquea con SELECT … FOR UPDATE.",
    "alembic_version": "Revisión de las migraciones Alembic aplicada a la base.",
    "cliente": "Persona o empresa que contrata la inspección (propiedad horizontal, empresa, persona natural o entidad pública), con su asesor.",
    "edificio": "Sedes o edificios del cliente donde están los equipos.",
    "equipo": "Ascensores con sus datos técnicos: paradas, recorrido, foso y capacidad.",
    "equipo_variante": "Variantes declaradas del equipo (tracción o hidráulico, tipo de máquina, etc.).",
    "norma": "Parte y edición de la NTC 5926 con sus plazos de corrección; una sola edición vigente por parte.",
    "checklist_categoria": "Capítulos o grupos de ítems de la norma.",
    "checklist_item": "Ítems que se califican en la inspección (169 en la NTC 5926-1:2012), con su calificación de defecto.",
    "checklist_item_variante": "Reglas de «no aplica»: un ítem sin filas aplica siempre; con filas, solo para esas variantes.",
    "variante_tipo": "Tipos de variante que filtran el checklist (por ejemplo, tipo de accionamiento).",
    "variante_opcion": "Opciones de cada tipo de variante.",
    "cotizacion": "Cotización enviada a un cliente para un edificio.",
    "cotizacion_equipo": "Servicio: un equipo dentro de una cotización, con su norma, valor, plazo de corrección y estado del flujo.",
    "historial_estado": "Cada cambio de estado de un servicio, con usuario, fecha y comentario.",
    "programacion": "Visita (primera o segunda) con fecha, hora e inspector asignado.",
    "programacion_equipo": "Equipos que cubre cada visita programada.",
    "inspeccion": "Una por servicio; guarda la primera visita y la segunda (cierre de hallazgos), el encabezado y los datos medidos.",
    "inspeccion_variante": "Variantes que eligió el inspector para el equipo inspeccionado.",
    "inspeccion_resultado": "Calificación de cada ítem y, en la segunda visita, si se corrigió el hallazgo.",
    "inspeccion_foto": "Fotos de evidencia; uuid_offline evita duplicados cuando el celular reenvía.",
    "inspeccion_firma": "Firmas del inspector, del técnico de mantenimiento y del representante del edificio.",
    "inspeccion_medicion": "Medidas tomadas durante la inspección (velocidad, holguras, aislamiento, etc.).",
    "inspeccion_instrumento": "Instrumentos de medición usados en cada inspección.",
    "instrumento_medicion": "Instrumentos de medición con su calibración y el inspector que los tiene.",
    "informe": "Un informe por visita (-1V, -2V) con concepto, atestación, firma del director, totales congelados, PDF y huella SHA-256.",
    "certificado": "Certificado emitido sobre un informe conforme, con vencimiento y código de verificación del QR.",
}

ACENTOS = {"numero": "número", "informacion": "información", "ultima": "última", "ultimo": "último",
           "codigo": "código", "descripcion": "descripción", "direccion": "dirección", "telefono": "teléfono",
           "razon": "razón", "inspeccion": "inspección", "medicion": "medición", "calibracion": "calibración",
           "observacion": "observación", "programacion": "programación", "cotizacion": "cotización",
           "creacion": "creación", "modificacion": "modificación", "sincronizacion": "sincronización",
           "anulacion": "anulación", "emision": "emisión", "aprobacion": "aprobación", "revision": "revisión",
           "categoria": "categoría", "condicion": "condición", "correccion": "corrección", "electronico": "electrónico",
           "matricula": "matrícula", "dias": "días", "tamano": "tamaño", "edicion": "edición", "atestacion": "atestación",
           "conservacion": "conservación", "acrilico": "acrílico", "pagina": "página", "titulo": "título",
           "fisica": "física", "tecnico": "técnico", "minimo": "mínimo", "maximo": "máximo", "valido": "válido",
           "calificacion": "calificación", "contrasena": "contraseña", "ubicacion": "ubicación", "telefonos": "teléfonos",
           "estandar": "estándar", "unico": "único", "version": "versión", "parametro": "parámetro", "clave": "clave",
           "notificacion": "notificación", "accion": "acción", "posicion": "posición", "huella": "huella",
           "vigencia": "vigencia", "pais": "país", "via": "vía", "energia": "energía", "electrica": "eléctrica",
           "maquina": "máquina", "camara": "cámara", "senal": "señal", "sesion": "sesión", "visita2": "visita 2",
           "dano": "daño", "area": "área", "electrico": "eléctrico", "metodo": "método", "periodo": "período", "limite": "límite"}

FIJAS = {"fecha_creacion": "Fecha y hora de creación del registro",
         "fecha_registro": "Fecha y hora de registro",
         "fecha_modificacion": "Fecha y hora de la última modificación",
         "uuid_offline": "Identificador generado en el celular para no duplicar reenvíos sin señal",
         "observaciones": "Observaciones", "observacion": "Observación", "nombre": "Nombre", "estado": "Estado"}


def _humano(nombre):
    palabras = [ACENTOS.get(p, p) for p in nombre.split("_")]
    t = " ".join(palabras)
    return t[:1].upper() + t[1:]


def _tam(tipo):
    m = re.match(r"(\w+)\(([^)]*)\)", tipo)
    if not m or m.group(1) == "ENUM":
        return "—"
    return m.group(2).replace(",", ", ")


def _tipo(tipo):
    return re.match(r"\w+", tipo).group(0).replace("TINYINT", "TINYINT")


def _restriccion(col, d):
    r, resto = [], col["resto"].upper()
    n = col["nombre"]
    if n in d["pk"]:
        r.append("PK")
    if "AUTO_INCREMENT" in resto:
        r.append("AUTO_INCREMENT")
    if n in d["fks"]:
        r.append(f"FK → {d['fks'][n][0]}")
    if "NOT NULL" in resto and n not in d["pk"]:
        r.append("NOT NULL")
    elif " NULL" in resto and "NOT NULL" not in resto:
        r.append("NULL")
    if "UNIQUE" in resto or n in d["unicos"]:
        r.append("UNIQUE")
    m = re.search(r"DEFAULT\s+('[^']*'|\S+)", col["resto"], re.I)
    if m:
        r.append(f"DEFAULT {m.group(1)}")
    if "ON UPDATE" in resto:
        r.append("ON UPDATE")
    if "GENERATED" in resto or " AS (" in resto:
        r.append("GENERADA")
    return ", ".join(r)


def _descripcion(col, tabla, d):
    n = col["nombre"]
    com = col["comentario"].strip().rstrip(".").replace("->", "→")
    if com and len(com) >= 40:
        base = com
    elif com:
        h = _humano(n)
        base = com if com.split()[0].lower() == h.split()[0].lower() else f"{h} ({com})"
    elif n in d["pk"] and len(d["pk"]) == 1:
        base = f"Identificador único de {_humano(tabla).lower()}"
    elif n in d["fks"]:
        padre = d["fks"][n][0]
        propio = n[3:] if n.startswith("id_") else n
        if propio == padre:
            base = f"Referencia a {_humano(padre).lower()}"
        else:
            base = f"{_humano(propio)} (referencia a {padre})"
    else:
        base = FIJAS.get(n) or _humano(n)
    if col["tipo"].startswith("ENUM"):
        valores = re.findall(r"'([^']*)'", col["tipo"])
        base += ": " + ", ".join(valores)
    return base


def diccionario():
    out = []
    for area, info in er.AREAS.items():
        for t in info["tablas"]:
            d = er.TABLAS[t]
            filas = [dict(campo=c["nombre"], tipo=_tipo(c["tipo"]), tam=_tam(c["tipo"]),
                          restriccion=_restriccion(c, d), descripcion=_descripcion(c, t, d)) for c in d["columnas"]]
            out.append(dict(tabla=t, area=area, descripcion=DESC_TABLA.get(t, ""), columnas=filas,
                            fks=[dict(columna=k, tabla=v[0], ref=v[1]) for k, v in d["fks"].items()]))
    return out


def acceso():
    res = {}
    for rol, a in er.ACCESO.items():
        if "*" in a:
            a = {t: "CRU" for t in er.TABLAS}
        res[rol] = {t: p for t, p in a.items() if t != "alembic_version"}
    return res


def imagenes():
    return {p.stem: list(Image.open(p).size) for p in sorted(IMG.glob("*.png"))}


def main():
    datos = dict(
        diccionario=diccionario(),
        areas={a: d["tablas"] for a, d in er.AREAS.items()},
        vistas=er.VISTAS,
        cu={k: dict(nombre=v[0], subs=v[1]) for k, v in casos.CU.items()},
        roles=casos.ROLES,
        modulos=MODULOS,
        acceso=acceso(),
        endpoints=endpoints.leer(),
        imagenes=imagenes(),
    )
    (AQUI / "contenido.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(datos["diccionario"]), "tablas,", len(datos["endpoints"]), "endpoints,", len(datos["imagenes"]), "imágenes")


if __name__ == "__main__":
    main()
