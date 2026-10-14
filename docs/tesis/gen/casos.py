"""Casos de uso del sistema: catálogo, roles y diagrama por rol (estilo del PDF, en oscuro)."""
from dibujo import C, Lienzo, LINEA, TENUE, leyenda

# Catálogo de casos de uso. sub = acciones que el caso incluye (i) o que lo extienden (e).
CU = {
    "CU-01": ("Iniciar sesión", [("i", "Ingresar correo y contraseña"), ("i", "Validar rol y estado activo"),
                                 ("e", "Cambiar contraseña")]),
    "CU-02": ("Gestionar usuarios", [("i", "Registrar usuario con rol"), ("e", "Crear acceso al portal del cliente"),
                                     ("e", "Editar datos y cargo"), ("e", "Activar, inactivar o bloquear")]),
    "CU-03": ("Configurar normas y checklist", [("i", "Registrar edición de la norma"),
                                                ("e", "Marcar la edición vigente"),
                                                ("e", "Definir plazos de corrección")]),
    "CU-04": ("Configurar parámetros", [("i", "Datos de la empresa y del informe"),
                                        ("e", "Metros por parada y sobre recorrido")]),
    "CU-05": ("Gestionar instrumentos de medición", [("i", "Registrar instrumento"),
                                                     ("e", "Asignar a un inspector")]),
    "CU-06": ("Registrar clientes, edificios y equipos", [("i", "Registrar cliente"), ("i", "Agregar edificio"),
                                                          ("e", "Generar varios equipos"),
                                                          ("e", "Editar datos del equipo")]),
    "CU-07": ("Crear y enviar cotización", [("i", "Elegir equipos y norma"), ("i", "Definir valor por equipo"),
                                            ("e", "Enviar al cliente"), ("e", "Anular cotización")]),
    "CU-08": ("Aprobar o rechazar cotización", [("i", "Revisar equipos y valor"), ("e", "Aprobar"),
                                                ("e", "Rechazar")]),
    "CU-09": ("Enviar a programación", [("i", "Aceptar la cotización aprobada")]),
    "CU-10": ("Programar visita", [("i", "Elegir inspector"), ("i", "Elegir fecha y hora"),
                                   ("i", "Validar que no sea un día pasado")]),
    "CU-11": ("Reprogramar o cancelar visita", [("i", "Registrar motivo del cambio"),
                                                ("e", "Devolver equipo a por programar")]),
    "CU-12": ("Consultar agenda", [("i", "Ver visitas asignadas"), ("e", "Guardar la inspección en el teléfono")]),
    "CU-13": ("Realizar inspección", [("i", "Registrar datos del equipo"), ("i", "Elegir variantes"),
                                      ("i", "Calificar el checklist"), ("e", "Registrar medidas")]),
    "CU-14": ("Registrar evidencia fotográfica", [("i", "Tomar o cargar foto"), ("e", "Asociar a un hallazgo")]),
    "CU-15": ("Registrar firmas", [("i", "Firma del inspector"), ("i", "Firma del técnico"),
                                   ("i", "Firma del representante")]),
    "CU-16": ("Trabajar sin señal", [("i", "Guardar en la cola del teléfono"), ("i", "Sincronizar al volver la señal"),
                                     ("e", "Reintentar o descartar un cambio")]),
    "CU-17": ("Finalizar inspección", [("i", "Validar lo pendiente"), ("i", "Generar informe en revisión")]),
    "CU-18": ("Revisar y aprobar informe", [("i", "Ver vista previa del PDF"), ("i", "Firmar y generar el PDF"),
                                            ("e", "Fijar plazo de corrección")]),
    "CU-19": ("Devolver informe al inspector", [("i", "Registrar observaciones")]),
    "CU-20": ("Solicitar segunda visita", [("i", "Validar el plazo de corrección")]),
    "CU-21": ("Elaborar y enviar certificado", [("i", "Generar PDF con código QR"), ("i", "Fijar vencimiento"),
                                                ("e", "Enviar al cliente")]),
    "CU-22": ("Anular certificado", [("i", "Registrar motivo de anulación")]),
    "CU-23": ("Consultar seguimiento e historial", [("i", "Filtrar por cotización, cliente o estado"),
                                                    ("e", "Ver historial de estados")]),
    "CU-24": ("Descargar informes y certificados", [("i", "Enlace temporal de descarga"),
                                                    ("e", "Informe de 1ª y 2ª visita")]),
    "CU-25": ("Verificar certificado por QR", [("i", "Consultar vigencia del certificado")]),
    "CU-26": ("Consultar tablero e indicadores", [("e", "Ver gráficas por estado")]),
    "CU-27": ("Recibir notificaciones", [("e", "Abrir la pantalla del aviso"), ("e", "Marcar como leídas")]),
}

ROLES = {
    "Administrador": dict(codigo="ADMIN", archivo="cu-administrador",
                          descripcion="Configura el sistema: usuarios, normas, parámetros e instrumentos. "
                                      "Además puede ejecutar cualquier acción de otro rol.",
                          cus=["CU-01", "CU-02", "CU-03", "CU-04", "CU-05"]),
    "Asesor": dict(codigo="ASESOR", archivo="cu-asesor",
                   descripcion="Registra clientes, edificios y equipos, cotiza y pasa lo aprobado a programación.",
                   cus=["CU-01", "CU-06", "CU-07", "CU-09", "CU-20", "CU-23", "CU-24"]),
    "Cliente": dict(codigo="CLIENTE", archivo="cu-cliente",
                    descripcion="Aprueba cotizaciones, solicita la segunda visita y descarga informes y certificados "
                                "desde el portal.",
                    cus=["CU-01", "CU-08", "CU-20", "CU-23", "CU-24"]),
    "Programación": dict(codigo="PROGRAMACION", archivo="cu-programacion",
                         descripcion="Agenda la primera y la segunda visita: inspector, fecha y hora.",
                         cus=["CU-01", "CU-10", "CU-11", "CU-23"]),
    "Inspector": dict(codigo="INSPECTOR", archivo="cu-inspector",
                      descripcion="Usuario principal en campo: ejecuta la inspección en el celular, con o sin señal.",
                      cus=["CU-01", "CU-12", "CU-13", "CU-14", "CU-15", "CU-16", "CU-17"]),
    "Director técnico": dict(codigo="DIRECTOR_TECNICO", archivo="cu-director",
                             descripcion="Revisa, atesta, firma y aprueba los informes o los devuelve al inspector.",
                             cus=["CU-01", "CU-18", "CU-19", "CU-23"]),
    "Certificados": dict(codigo="CERTIFICADOS", archivo="cu-certificados",
                         descripcion="Elabora, envía y, si es necesario, anula los certificados de los informes "
                                     "conformes.",
                         cus=["CU-01", "CU-21", "CU-22"]),
    "Público": dict(codigo="(sin sesión)", archivo="cu-publico",
                    descripcion="Cualquier persona que lee el código QR del certificado para comprobar que es válido.",
                    cus=["CU-25"]),
}


def leyenda_fila(lz, x, y):
    """Leyenda en una sola fila, debajo del título del sistema."""
    items = [("elipse", "celeste", "Caso de uso principal"), ("elipse", "ambar", "Acción incluida o extendida"),
             ("guion", "#22c55e", "«include» obligatoria"), ("guion", "#f59e0b", "«extend» opcional")]
    from dibujo import ancho
    for tipo, estilo, t in items:
        leyenda(lz, x, y, [(tipo, estilo, t)])
        x += 40 + ancho(t, 12) + 34


def diagrama_rol(nombre, rol, ruta):
    filas = []  # (cu, subs)
    for c in rol["cus"]:
        filas.append((c, CU[c][1]))
    paso = 50
    margen_sup = 150
    alto_bloques = [max(len(s), 1) * paso + 22 for _, s in filas]
    h = margen_sup + sum(alto_bloques) + 40
    h = max(h, 420)
    comun = rol["codigo"] != "(sin sesión)"
    if comun:
        h += 26
    w = 1100
    lz = Lienzo(w, h, f"Casos de uso: {nombre}", rol["descripcion"] if len(rol["descripcion"]) < 120 else None)
    # límite del sistema
    sx, sy, sw, sh = 250, 90, w - 270, h - 110 - (26 if comun else 0)
    lz.fondo.insert(0, f'<rect x="{sx}" y="{sy}" width="{sw}" height="{sh}" rx="16" fill="#18202e" '
                       f'stroke="#3b4a63" stroke-width="1.6"/>')
    lz.texto(sx + 20, sy + 24, "Sistema ServiLift", 16, "#93c5fd", True, anchor="start")
    leyenda_fila(lz, sx + 20, sy + 58)
    ax, ay = 120, margen_sup + sum(alto_bloques) / 2
    lz.actor(ax, ay, nombre)
    y = margen_sup + 20
    for (c, subs), alto in zip(filas, alto_bloques):
        cy = y + alto / 2 - 10
        cx = 430
        lz.elipse(cx, cy, 128, 34, f"{c}: {CU[c][0]}", "celeste", 13)
        lz.flecha([(ax + 26, ay - 8), (cx - 128, cy)], color="#cbd5e1", punta=False, grosor=1.4)
        n = len(subs)
        for j, (tipo, t) in enumerate(subs):
            sy_ = cy + (j - (n - 1) / 2) * paso
            ex = 780
            lz.elipse(ex, sy_, 125, 21, t, "ambar", 12, negrita=False)
            color = "#22c55e" if tipo == "i" else "#f59e0b"
            etiqueta = "«include»" if tipo == "i" else "«extend»"
            if tipo == "i":
                pts = [(cx + 128, cy), (ex - 125, sy_)]
            else:
                pts = [(ex - 125, sy_), (cx + 128, cy)]
            lz.flecha(pts, color=color, guion=True, etiqueta=etiqueta, pos_etiqueta=0.5, tam=10)
        y += alto
    if comun:
        lz.texto(w / 2, h - 18, "Además, todos los roles con sesión usan CU-26 Consultar tablero e indicadores y "
                 "CU-27 Recibir notificaciones.", 12, TENUE)
    lz.guardar(ruta)


def diagrama_general(ruta):
    """Vista general: un panel por módulo con sus casos de uso y los roles que los usan."""
    from dibujo import ancho
    from modulos import MODULOS
    abrev = {"Administrador": "Admin", "Asesor": "Asesor", "Cliente": "Cliente", "Programación": "Programación",
             "Inspector": "Inspector", "Director técnico": "Director", "Certificados": "Certificados",
             "Público": "Público"}
    color_rol = {"Administrador": "azul", "Asesor": "teal", "Cliente": "verde", "Programación": "morado",
                 "Inspector": "ambar", "Director técnico": "rosa", "Certificados": "celeste", "Público": "gris"}
    w = 1500
    colw = (w - 60 * 2 - 40) / 2
    lz = Lienzo(w, 100, "Casos de uso del sistema ServiLift", "27 casos de uso en siete módulos · al lado de cada "
                "caso, los roles que lo ejecutan")
    # leyenda de roles
    x = 60
    for r, est in color_rol.items():
        tw = ancho(abrev[r], 12, True) + 20
        relleno, borde, color = C[est]
        lz.partes.append(f'<rect x="{x}" y="88" width="{tw}" height="22" rx="11" fill="{relleno}" stroke="{borde}"/>')
        lz.texto(x + tw / 2, 99, abrev[r], 12, color, True)
        x += tw + 10
    ycol = [130, 130]
    estilos = ["azul", "morado", "teal", "verde", "ambar", "rosa", "celeste"]
    for k, (mod, cus) in enumerate(MODULOS.items()):
        col = 0 if ycol[0] <= ycol[1] else 1
        x0, y0 = 60 + col * (colw + 40), ycol[col]
        alto = 50 + len(cus) * 44
        relleno, borde, color = C[estilos[k]]
        lz.partes.append(f'<rect x="{x0}" y="{y0}" width="{colw}" height="{alto}" rx="14" fill="#18202e" '
                         f'stroke="{borde}" stroke-width="1.6"/>')
        lz.texto(x0 + 18, y0 + 24, mod, 15, color, True, anchor="start")
        for j, c in enumerate(cus):
            cy = y0 + 62 + j * 44
            lz.elipse(x0 + 190, cy, 170, 18, f"{c}  {CU[c][0]}", "celeste", 12, negrita=False)
            roles = [r for r, d in ROLES.items() if c in d["cus"]]
            if c in ("CU-01", "CU-26", "CU-27"):
                roles = ["Todos con sesión"]
            bx = x0 + 380
            for r in roles:
                txt = abrev.get(r, r)
                tw = ancho(txt, 11, True) + 16
                est = color_rol.get(r, "gris")
                rr, bb, cc = C[est]
                lz.partes.append(f'<rect x="{bx}" y="{cy - 10}" width="{tw}" height="20" rx="10" fill="{rr}" '
                                 f'stroke="{bb}"/>')
                lz.texto(bx + tw / 2, cy, txt, 11, cc, True)
                bx += tw + 6
        ycol[col] = y0 + alto + 24
    lz.h = max(ycol) + 20
    lz.guardar(ruta)
