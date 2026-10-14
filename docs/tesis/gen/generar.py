"""Genera todos los diagramas de la tesis en ../img como SVG. Luego: NODE_PATH=$(npm root -g) node render.cjs ../img"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import casos  # noqa: E402
import er  # noqa: E402
import otros  # noqa: E402

IMG = Path(__file__).resolve().parent.parent / "img"

AREAS_COLUMNAS = {
    "Seguridad y sistema": ("er-seguridad", [["rol", "parametro"], ["usuario", "cliente"],
                                             ["notificacion", "consecutivo", "alembic_version"]]),
    "Clientes y equipos": ("er-clientes", [["usuario", "cliente"], ["edificio", "equipo"],
                                           ["equipo_variante", "variante_tipo", "variante_opcion"]]),
    "Normas y checklist": ("er-normas", [["norma", "checklist_categoria"], ["checklist_item", "variante_tipo"],
                                         ["checklist_item_variante", "variante_opcion"]]),
    "Comercial y programación": ("er-comercial", [["cliente", "edificio", "equipo", "norma"],
                                                  ["cotizacion"], ["cotizacion_equipo", "historial_estado"],
                                                  ["programacion", "programacion_equipo", "usuario"]]),
    "Inspección en campo": ("er-inspeccion", [["cotizacion_equipo", "programacion", "norma", "usuario"],
                                              ["inspeccion", "inspeccion_variante"],
                                              ["inspeccion_resultado", "inspeccion_foto", "checklist_item"],
                                              ["inspeccion_firma", "inspeccion_medicion",
                                               "inspeccion_instrumento", "instrumento_medicion"]]),
    "Informes y certificados": ("er-informes", [["inspeccion", "usuario"], ["informe"],
                                                ["certificado", "cotizacion_equipo"]]),
}

ARCH_ROL = {"Administrador": "datos-administrador", "Asesor": "datos-asesor", "Cliente": "datos-cliente",
            "Programación": "datos-programacion", "Inspector": "datos-inspector",
            "Director técnico": "datos-director", "Certificados": "datos-certificados"}


def main():
    casos.diagrama_general(IMG / "cu-general.svg")
    for nombre, rol in casos.ROLES.items():
        casos.diagrama_rol(nombre, rol, IMG / f"{rol['archivo']}.svg")
    er.diagrama_general(IMG / "er-general.svg")
    for area, (arch, cols) in AREAS_COLUMNAS.items():
        er.diagrama_area(area, cols, IMG / f"{arch}.svg")
    for rol, arch in ARCH_ROL.items():
        er.diagrama_datos_rol(rol, IMG / f"{arch}.svg")
    for f in ["componentes", "capas", "despliegue", "flujo_negocio", "estados", "sincronizacion", "mutacion",
              "piramide", "ci"]:
        getattr(otros, f)(IMG / f"{f.replace('_', '-')}.svg")


if __name__ == "__main__":
    main()
