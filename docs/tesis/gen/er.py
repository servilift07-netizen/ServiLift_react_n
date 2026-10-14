"""Diagramas de la base de datos: vista general, uno por área y uno por rol."""
from dibujo import C, Lienzo, TENUE, TEXTO, ancho, leyenda
from esquema import leer

TABLAS, VISTAS = leer()

AREAS = {
    "Seguridad y sistema": dict(estilo="azul", tablas=["rol", "usuario", "notificacion", "parametro",
                                                       "consecutivo", "alembic_version"]),
    "Clientes y equipos": dict(estilo="teal", tablas=["cliente", "edificio", "equipo", "equipo_variante"]),
    "Normas y checklist": dict(estilo="morado", tablas=["norma", "checklist_categoria", "checklist_item",
                                                        "checklist_item_variante", "variante_tipo",
                                                        "variante_opcion"]),
    "Comercial y programación": dict(estilo="verde", tablas=["cotizacion", "cotizacion_equipo", "historial_estado",
                                                             "programacion", "programacion_equipo"]),
    "Inspección en campo": dict(estilo="ambar", tablas=["inspeccion", "inspeccion_variante", "inspeccion_resultado",
                                                        "inspeccion_foto", "inspeccion_firma", "inspeccion_medicion",
                                                        "inspeccion_instrumento", "instrumento_medicion"]),
    "Informes y certificados": dict(estilo="rosa", tablas=["informe", "certificado"]),
}
AREA_DE = {t: a for a, d in AREAS.items() for t in d["tablas"]}

FILA = 21
ANCHO_T = 300


def _tipo_corto(tipo):
    if tipo.startswith("ENUM"):
        return "ENUM"
    return tipo.replace("TINYINT(1)", "BOOL")


def tabla(lz, x, y, nombre, estilo, columnas=True, ancho_t=ANCHO_T, resaltar=None, etiqueta=None):
    """Dibuja una tabla. Devuelve dict con caja y y de cada columna."""
    t = TABLAS[nombre]
    relleno, borde, color = C[estilo]
    cols = t["columnas"] if columnas else []
    h = 34 + len(cols) * FILA + (8 if cols else 0)
    lz.partes.append(f'<rect x="{x}" y="{y}" width="{ancho_t}" height="{h}" rx="8" fill="#1a2130" stroke="{borde}" '
                     f'stroke-width="1.6"/>')
    lz.partes.append(f'<path d="M{x} {y + 8} a8 8 0 0 1 8 -8 h{ancho_t - 16} a8 8 0 0 1 8 8 v26 h-{ancho_t} z" '
                     f'fill="{relleno}" stroke="{borde}" stroke-width="1.6"/>')
    lz.texto(x + 12, y + 17, nombre, 14, color, True, anchor="start")
    if etiqueta:
        lz.texto(x + ancho_t - 10, y + 17, etiqueta, 11, color, anchor="end")
    filas = {}
    for i, c in enumerate(cols):
        yy = y + 34 + 4 + i * FILA + FILA / 2
        filas[c["nombre"]] = yy
        es_pk = c["nombre"] in t["pk"]
        es_fk = c["nombre"] in t["fks"]
        marca = "PK" if es_pk else ("FK" if es_fk else "")
        if marca:
            mc = "#facc15" if es_pk else "#60a5fa"
            lz.partes.append(f'<rect x="{x + 8}" y="{yy - 8}" width="24" height="16" rx="4" fill="none" '
                             f'stroke="{mc}" stroke-width="1"/>')
            lz.texto(x + 20, yy, marca, 9, mc, True)
        nombre_col = c["nombre"]
        max_n = ancho_t - 150
        while ancho(nombre_col, 12) > max_n:
            nombre_col = nombre_col[:-2] + "…"
        lz.texto(x + 40, yy, nombre_col, 12, TEXTO if (es_pk or es_fk) else "#cbd5e1", es_pk, anchor="start")
        lz.texto(x + ancho_t - 10, yy, _tipo_corto(c["tipo"]), 11, TENUE, anchor="end")
    return dict(x=x, y=y, w=ancho_t, h=h, filas=filas)


def stub(lz, x, y, nombre, w=200):
    relleno, borde, color = C["gris"]
    lz.partes.append(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="8" fill="{relleno}" stroke="{borde}" '
                     f'stroke-width="1.4" stroke-dasharray="5 4"/>')
    lz.texto(x + w / 2, y + 17, nombre, 13, "#cbd5e1", True)
    return dict(x=x, y=y, w=w, h=34, filas={})


def relacion(lz, hijo, col, padre, color="#94a3b8"):
    """Línea ortogonal desde la columna FK del hijo hasta el encabezado del padre, con 1 y N."""
    yh = hijo["filas"].get(col, hijo["y"] + 17)
    yp = padre["y"] + 17
    if padre is hijo:  # autorrelación
        x0 = hijo["x"] + hijo["w"]
        pts = [(x0, yh), (x0 + 26, yh), (x0 + 26, yp), (x0, yp)]
        lz.flecha(pts, color=color, punta=False, grosor=1.4)
        lz.texto(x0 + 34, yh, "N", 11, color, True)
        lz.texto(x0 + 34, yp, "1", 11, color, True)
        return
    hc = hijo["x"] + hijo["w"] / 2
    pc = padre["x"] + padre["w"] / 2
    if abs(hc - pc) < 20:  # misma columna: sale por la izquierda
        x0 = hijo["x"]
        x1 = padre["x"]
        xm = min(x0, x1) - 22
        pts = [(x0, yh), (xm, yh), (xm, yp), (x1, yp)]
        n_pos, uno_pos = (x0 - 10, yh - 9), (x1 - 10, yp - 9)
    elif pc > hc:
        x0 = hijo["x"] + hijo["w"]
        x1 = padre["x"]
        xm = (x0 + x1) / 2
        pts = [(x0, yh), (xm, yh), (xm, yp), (x1, yp)]
        n_pos, uno_pos = (x0 + 10, yh - 9), (x1 - 10, yp - 9)
    else:
        x0 = hijo["x"]
        x1 = padre["x"] + padre["w"]
        xm = (x0 + x1) / 2
        pts = [(x0, yh), (xm, yh), (xm, yp), (x1, yp)]
        n_pos, uno_pos = (x0 - 10, yh - 9), (x1 + 10, yp - 9)
    lz.flecha(pts, color=color, punta=False, grosor=1.4)
    for (px, py) in pts[:1] + pts[-1:]:
        lz.partes.append(f'<circle cx="{px}" cy="{py}" r="3" fill="{color}"/>')
    lz.texto(*n_pos, "N", 11, color, True)
    lz.texto(*uno_pos, "1", 11, color, True)


def diagrama_area(nombre_area, columnas, ruta, ancho_lienzo=None, titulo=None):
    """columnas: lista de listas de nombres de tabla (los que no son del área se dibujan como referencia)."""
    estilo = AREAS[nombre_area]["estilo"]
    xs, x = [], 60
    for col in columnas:
        xs.append(x)
        x += ANCHO_T + 120
    w = ancho_lienzo or x - 60
    cajas, alto_max = {}, 0
    lz = Lienzo(w, 100, titulo or f"Modelo de datos: {nombre_area}",
                "Tablas del área con todas sus columnas · en gris punteado, tablas de otras áreas")
    for xi, col in zip(xs, columnas):
        y = 100
        for t in col:
            if t in AREAS[nombre_area]["tablas"]:
                cajas[t] = tabla(lz, xi, y, t, estilo)
            else:
                cajas[t] = stub(lz, xi + (ANCHO_T - 200) / 2, y, t)
            y += cajas[t]["h"] + 40
        alto_max = max(alto_max, y)
    for t, caja in cajas.items():
        if t not in AREAS[nombre_area]["tablas"]:
            continue
        for col, (padre, _) in TABLAS[t]["fks"].items():
            if padre in cajas:
                relacion(lz, caja, col, cajas[padre])
    lz.h = alto_max + 30
    lz.guardar(ruta)


def diagrama_general(ruta):
    """Un panel por área con sus tablas y relaciones internas; entre paneles, una flecha por grupo de llaves."""
    pw, ph, gap = 520, 400, 140
    xs = [40, 40 + pw + gap, 40 + 2 * (pw + gap)]
    ys = [110, 110 + ph + gap]
    w, h = xs[2] + pw + 40, ys[1] + ph + 90
    lz = Lienzo(w, h, "Modelo entidad-relación de ServiLift",
                f"{len(TABLAS)} tablas en seis áreas y {len(VISTAS)} vistas · las flechas van de la tabla hija "
                "(N) a la tabla padre (1)")
    P = {"Clientes y equipos": (xs[0], ys[0]), "Normas y checklist": (xs[1], ys[0]),
         "Seguridad y sistema": (xs[2], ys[0]), "Comercial y programación": (xs[0], ys[1]),
         "Inspección en campo": (xs[1], ys[1]), "Informes y certificados": (xs[2], ys[1])}
    bw, bh = 210, 34
    # posiciones (columna 0/1/"c" centrada, fila)
    pos = {
        "Clientes y equipos": {"cliente": ("c", 0), "edificio": ("c", 1), "equipo": ("c", 2),
                               "equipo_variante": ("c", 3)},
        "Normas y checklist": {"norma": (0, 0), "checklist_categoria": (0, 1), "checklist_item": (0, 2),
                               "checklist_item_variante": (0, 3), "variante_tipo": (1, 0),
                               "variante_opcion": (1, 1)},
        "Seguridad y sistema": {"rol": (0, 0), "usuario": (0, 1), "notificacion": (0, 2), "parametro": (1, 0),
                                "consecutivo": (1, 1), "alembic_version": (1, 2)},
        "Comercial y programación": {"cotizacion": (0, 0), "cotizacion_equipo": (0, 1), "historial_estado": (0, 2),
                                     "programacion": (1, 0), "programacion_equipo": (1, 1)},
        "Inspección en campo": {"inspeccion": ("c", 0), "inspeccion_resultado": (0, 1), "inspeccion_foto": (0, 2),
                                "inspeccion_medicion": (0, 3), "inspeccion_variante": (1, 1),
                                "inspeccion_firma": (1, 2), "inspeccion_instrumento": (1, 3),
                                "instrumento_medicion": (1, 4)},
        "Informes y certificados": {"informe": ("c", 0), "certificado": ("c", 1)},
    }
    cajas = {}
    for area, (px, py) in P.items():
        relleno, borde, color = C[AREAS[area]["estilo"]]
        lz.fondo.insert(0, f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="14" fill="{relleno}" '
                           f'fill-opacity="0.35" stroke="{borde}" stroke-width="1.4"/>')
        lz.texto(px + 18, py + 24, area, 15, color, True, anchor="start")
        for t, (c, f) in pos[area].items():
            bx = px + (pw - bw) / 2 if c == "c" else px + 30 + c * (pw - 60 - bw)
            by = py + 60 + f * 64
            lz.partes.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="7" fill="{relleno}" '
                             f'stroke="{borde}" stroke-width="1.5"/>')
            lz.texto(bx + bw / 2, by + bh / 2, t, 12.5 if len(t) < 21 else 11.5, color, True)
            cajas[t] = (bx, by, bw, bh)
    gris = "#7c8aa0"

    def v(a, b):  # misma columna, b arriba de a
        x = cajas[a][0] + bw / 2
        lz.flecha([(x, cajas[a][1]), (x, cajas[b][1] + bh)], color=gris, capa="partes")

    def hz(a, b):
        A, B = cajas[a], cajas[b]
        y = A[1] + bh / 2
        lz.flecha([(A[0], y), (B[0] + bw, y)] if A[0] > B[0] else [(A[0] + bw, y), (B[0], y)], color=gris,
                  capa="partes")

    def izq(a, b):  # misma columna, salta filas por la izquierda
        A, B = cajas[a], cajas[b]
        x = A[0] - 14
        lz.flecha([(A[0], A[1] + bh / 2), (x, A[1] + bh / 2), (x, B[1] + bh / 2), (B[0], B[1] + bh / 2)],
                  color=gris, capa="partes")

    for a, b in [("edificio", "cliente"), ("equipo", "edificio"), ("equipo_variante", "equipo"),
                 ("checklist_categoria", "norma"), ("checklist_item", "checklist_categoria"),
                 ("checklist_item_variante", "checklist_item"), ("variante_opcion", "variante_tipo"),
                 ("usuario", "rol"), ("notificacion", "usuario"), ("cotizacion_equipo", "cotizacion"),
                 ("historial_estado", "cotizacion_equipo"), ("programacion_equipo", "programacion"),
                 ("inspeccion_foto", "inspeccion_resultado"), ("instrumento_medicion", "inspeccion_instrumento"),
                 ("certificado", "informe")]:
        if a == "instrumento_medicion":  # el padre es instrumento_medicion
            v_ = cajas["instrumento_medicion"][0] + bw / 2
            lz.flecha([(v_, cajas["inspeccion_instrumento"][1] + bh), (v_, cajas["instrumento_medicion"][1])],
                      color=gris, capa="partes")
        else:
            v(a, b)
    izq("checklist_item", "norma")
    hz("programacion", "cotizacion")
    hz("programacion_equipo", "cotizacion_equipo")
    # checklist_item_variante -> variante_opcion
    A, B = cajas["checklist_item_variante"], cajas["variante_opcion"]
    lz.flecha([(A[0] + bw, A[1] + bh / 2), (B[0] + bw / 2, A[1] + bh / 2), (B[0] + bw / 2, B[1] + bh)],
              color=gris, capa="partes")
    # inspección: tronco central hacia inspeccion
    ins = cajas["inspeccion"]
    xt = ins[0] + bw / 2
    for hijo in ["inspeccion_resultado", "inspeccion_foto", "inspeccion_medicion", "inspeccion_variante",
                 "inspeccion_firma", "inspeccion_instrumento"]:
        A = cajas[hijo]
        borde_x = A[0] + bw if A[0] < xt else A[0]
        lz.flecha([(borde_x, A[1] + bh / 2), (xt, A[1] + bh / 2)], color=gris, punta=False, capa="partes")
    ultimo = max(cajas[hj][1] for hj in ["inspeccion_medicion", "inspeccion_instrumento"]) + bh / 2
    lz.flecha([(xt, ultimo), (xt, ins[1] + bh)], color=gris, capa="partes")

    # entre áreas
    azul = "#a5b4fc"
    (cx, cy), (nx, ny), (sx, sy) = P["Clientes y equipos"], P["Normas y checklist"], P["Seguridad y sistema"]
    (mx, my), (ix, iy), (fx, fy) = P["Comercial y programación"], P["Inspección en campo"], \
        P["Informes y certificados"]
    lz.flecha([(cx + pw, cy + 200), (nx, ny + 200)], color=azul, grosor=2.2, etiqueta="variantes", tam=12)
    lz.flecha([(mx + 140, my), (cx + 140, cy + ph)], color=azul, grosor=2.2, etiqueta="cliente, edificio, equipo",
              tam=12)
    lz.flecha([(mx + pw, my + 30), (nx + 30, ny + ph)], color=azul, grosor=2.2, etiqueta="norma", tam=12)
    lz.flecha([(ix + 140, iy), (nx + 140, ny + ph)], color=azul, grosor=2.2, etiqueta="norma, ítems, variantes",
              tam=12)
    lz.flecha([(ix, iy + 200), (mx + pw, my + 200)], color=azul, grosor=2.2, etiqueta="servicio y visita", tam=12)
    lz.flecha([(fx, fy + 76), (ix + pw, iy + 76)], color=azul, grosor=2.2, etiqueta="inspección", tam=12)
    lz.flecha([(fx + pw / 2, fy + ph), (fx + pw / 2, fy + ph + 40), (mx + pw / 2, fy + ph + 40),
               (mx + pw / 2, my + ph)], color=azul, grosor=2.2, etiqueta="certificado → servicio (cotizacion_equipo)",
              tam=12)
    n_usuario = sum(1 for t, d in TABLAS.items() for c, (p, _) in d["fks"].items()
                    if p == "usuario" and AREA_DE[t] != "Seguridad y sistema")
    lz.caja(sx + 30, sy + 260, pw - 60, 110, "usuario es la tabla más referenciada", "panel", 13,
            sub=f"{n_usuario} llaves foráneas de otras áreas apuntan a ella (asesor, inspector, programador, "
                "director, emisor, firmas). No se dibujan para no saturar el diagrama.")
    lz.guardar(ruta)


# ---------------- datos por rol ----------------
ACCESO = {
    "Administrador": {"*": "CRU"},
    "Asesor": {"cliente": "CRU", "edificio": "CRU", "equipo": "CRU", "equipo_variante": "CRU",
               "cotizacion": "CRU", "cotizacion_equipo": "CRU", "historial_estado": "C", "consecutivo": "U",
               "norma": "R", "informe": "R", "certificado": "R", "notificacion": "RU"},
    "Cliente": {"cotizacion": "RU", "cotizacion_equipo": "RU", "historial_estado": "CR", "edificio": "R",
                "equipo": "R", "informe": "R", "certificado": "R", "notificacion": "RU"},
    "Programación": {"programacion": "CRU", "programacion_equipo": "CRU", "cotizacion_equipo": "RU",
                     "historial_estado": "C", "cotizacion": "R", "usuario": "R", "edificio": "R",
                     "notificacion": "RU"},
    "Inspector": {"inspeccion": "CRU", "inspeccion_variante": "CRU", "inspeccion_resultado": "CRU",
                  "inspeccion_foto": "CRUD", "inspeccion_firma": "CRU", "inspeccion_medicion": "CRU",
                  "inspeccion_instrumento": "CRU", "informe": "C", "consecutivo": "U", "programacion": "RU",
                  "cotizacion_equipo": "RU", "historial_estado": "C", "equipo": "RU", "checklist_item": "R",
                  "checklist_categoria": "R", "checklist_item_variante": "R", "variante_tipo": "R",
                  "variante_opcion": "R", "norma": "R", "instrumento_medicion": "R", "notificacion": "RU"},
    "Director técnico": {"informe": "RU", "inspeccion": "RU", "inspeccion_resultado": "RU",
                         "inspeccion_foto": "R", "inspeccion_firma": "R", "cotizacion_equipo": "RU",
                         "historial_estado": "C", "usuario": "R", "norma": "R", "notificacion": "RU"},
    "Certificados": {"certificado": "CRU", "informe": "RU", "cotizacion_equipo": "RU", "historial_estado": "C",
                     "consecutivo": "U", "notificacion": "RU"},
}
# Todos los roles con sesión leen su propio usuario y su rol al iniciar sesión.
for _r in ACCESO.values():
    if "*" not in _r:
        _r.setdefault("usuario", "R")
        _r.setdefault("rol", "R")


CODIGO_ROL = {"Administrador": "ADMIN", "Asesor": "ASESOR", "Cliente": "CLIENTE", "Programación": "PROGRAMACION",
              "Inspector": "INSPECTOR", "Director técnico": "DIRECTOR_TECNICO", "Certificados": "CERTIFICADOS"}


def diagrama_datos_rol(rol, ruta):
    """Tablas que toca un rol, agrupadas por área, con sus permisos C R U D."""
    acceso = ACCESO[rol]
    if "*" in acceso:
        acceso = {t: "CRUD" if t in ("inspeccion_foto",) else "CRU" for t in TABLAS}
    acceso = {t: p for t, p in acceso.items() if t != "alembic_version"}
    grupos = [(a, [t for t in d["tablas"] if t in acceso]) for a, d in AREAS.items()]
    grupos = [(a, ts) for a, ts in grupos if ts]
    ncol = 3 if sum(len(ts) for _, ts in grupos) > 8 else 2
    pw, gx, x0, y0 = 400, 30, 300, 150
    alturas = [y0] * ncol
    ubic = []
    for a, ts in grupos:
        ph = 56 + len(ts) * 56
        c = alturas.index(min(alturas))
        ubic.append((a, ts, x0 + c * (pw + gx), alturas[c], ph))
        alturas[c] += ph + 26
    w = x0 + ncol * (pw + gx) + 10
    h = max(max(alturas) + 20, 520)
    lz = Lienzo(w, h, f"Datos que usa el rol: {rol}",
                "Verde: el rol crea o modifica registros · Azul: solo consulta · C crear, R consultar, U actualizar, D eliminar")
    leyenda(lz, x0, 108, [("caja", "verde", "Crea o modifica")])
    leyenda(lz, x0 + 200, 108, [("caja", "celeste", "Solo consulta")])
    # actor
    lz.caja(40, y0, 220, h - y0 - 40, "", "panel", r=14, capa=lz.fondo)
    lz.actor(150, y0 + 120, rol)
    lz.texto(150, y0 + 220, CODIGO_ROL[rol], 12, TENUE)
    escribe_n = sum(1 for p in acceso.values() if any(ch in p for ch in "CUD"))
    lz.texto(150, y0 + 262, f"{len(acceso)} tablas", 14, TEXTO, True)
    lz.texto(150, y0 + 286, f"escribe en {escribe_n}", 12, "#86efac")
    lz.texto(150, y0 + 306, f"solo lee {len(acceso) - escribe_n}", 12, "#7dd3fc")
    for a, ts, px, py, ph in ubic:
        relleno, borde, color = C[AREAS[a]["estilo"]]
        lz.fondo.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="12" fill="{relleno}" '
                        f'fill-opacity="0.35" stroke="{borde}" stroke-width="1.4"/>')
        lz.texto(px + 16, py + 24, a, 14, color, True, anchor="start")
        for k, t in enumerate(ts):
            permiso = acceso[t]
            est = "verde" if any(ch in permiso for ch in "CUD") else "celeste"
            r2, b2, c2 = C[est]
            bx, by = px + 14, py + 46 + k * 56
            lz.partes.append(f'<rect x="{bx}" y="{by}" width="{pw - 28}" height="44" rx="8" fill="{r2}" '
                             f'stroke="{b2}" stroke-width="1.5"/>')
            lz.texto(bx + 14, by + 22, t, 13.5, c2, True, anchor="start")
            for n, letra in enumerate("CRUD"):
                cx = bx + pw - 28 - 112 + n * 26
                activo = letra in permiso
                fondo_l = b2 if activo else "none"
                lz.partes.append(f'<rect x="{cx}" y="{by + 11}" width="22" height="22" rx="5" fill="{fondo_l}" '
                                 f'stroke="{b2 if activo else "#3b4558"}" stroke-width="1.2"/>')
                lz.texto(cx + 11, by + 22, letra, 12, "#0b1220" if activo else "#4b5563", True)
    lz.guardar(ruta)
    return list(acceso)


def _permiso_texto(p):
    nombres = {"C": "crea", "R": "consulta", "U": "modifica", "D": "elimina"}
    return ", ".join(nombres[ch] for ch in p).capitalize()


def _linea_entre(a, b):
    def centro(c):
        return c[0] + c[2] / 2, c[1] + c[3] / 2

    def borde(c, hacia):
        x, y, w, h = c
        cx, cy = centro(c)
        dx, dy = hacia[0] - cx, hacia[1] - cy
        if abs(dx) * h > abs(dy) * w:
            return (x + w if dx > 0 else x, cy + dy * (w / 2) / abs(dx) if dx else cy)
        return (cx + dx * (h / 2) / abs(dy) if dy else cx, y + h if dy > 0 else y)
    return [borde(a, centro(b)), borde(b, centro(a))]
