"""Arquitectura, despliegue, flujo del negocio, estados, sincronización y pruebas."""
from dibujo import C, Lienzo, TENUE, TEXTO, ancho, leyenda, partir


def componentes(ruta):
    w, h = 1500, 820
    lz = Lienzo(w, h, "Arquitectura de componentes", "Cliente-servidor en tres capas: app, API y base de datos")
    # Clientes
    lz.caja(40, 110, 360, 660, "", "panel", r=16, capa=lz.fondo)
    lz.texto(220, 136, "Clientes (servilift-app)", 16, "#93c5fd", True)
    lz.caja(70, 170, 300, 120, "App en el celular", "ambar", 15, sub="Android / iOS con Expo · Inspector en campo")
    lz.caja(70, 310, 300, 120, "App en el navegador", "teal", 15,
            sub="Expo web · Asesor, programación, director, certificados, administrador y cliente")
    lz.caja(70, 450, 300, 70, "Cola sin conexión", "gris", 14, sub="AsyncStorage + motor de sincronización")
    lz.caja(70, 540, 300, 70, "Sesión segura", "gris", 14, sub="SecureStore (celular) · sessionStorage (web)")
    lz.caja(70, 630, 300, 110, "React Native 0.86 · Expo SDK 57", "panel", 13,
            sub="TypeScript · Expo Router · React Native Paper", negrita=True)
    # API
    lz.caja(480, 110, 520, 660, "", "panel", r=16, capa=lz.fondo)
    lz.texto(740, 136, "API REST (servilift-backend)", 16, "#93c5fd", True)
    lz.caja(510, 170, 460, 80, "Rutas por módulo · FastAPI", "azul", 15,
            sub="auth, usuarios, clientes, cotizaciones, programación, inspecciones, informes, certificados…")
    lz.caja(510, 270, 220, 90, "Seguridad", "rojo", 14, sub="JWT, PBKDF2, permisos por rol, enlaces firmados")
    lz.caja(750, 270, 220, 90, "Validación", "morado", 14, sub="Pydantic 2 · esquemas de entrada y salida")
    lz.caja(510, 380, 460, 100, "Servicios de negocio", "verde", 15,
            sub="flujo (estados y consecutivos) · checklist (aplicabilidad) · reglas · pdf · archivos")
    lz.caja(510, 500, 220, 80, "Generador PDF", "rosa", 14, sub="ReportLab + QR")
    lz.caja(750, 500, 220, 80, "Archivos", "rosa", 14, sub="Pillow · fotos, firmas y PDF")
    lz.caja(510, 600, 460, 70, "Modelos ORM · SQLAlchemy 2", "celeste", 14, sub="31 tablas mapeadas en models.py")
    lz.caja(510, 690, 460, 60, "Python 3.13 · uv · Alembic (migraciones 0001 a 0005)", "panel", 13)
    # Datos
    lz.caja(1080, 110, 380, 660, "", "panel", r=16, capa=lz.fondo)
    lz.texto(1270, 136, "Datos", 16, "#93c5fd", True)
    lz.caja(1110, 170, 320, 170, "MariaDB 10.11", "celeste", 16,
            sub="servilift_db · utf8mb4 · hora de Colombia · Docker, puerto 3307")
    lz.caja(1110, 360, 320, 90, "Base de pruebas", "gris", 14, sub="servilift_v2_prueba (integración y E2E)")
    lz.caja(1110, 470, 320, 110, "Almacenamiento de archivos", "rosa", 14,
            sub="carpeta storage/: fotos, firmas y PDF; se sirven solo con enlace firmado")
    lz.caja(1110, 600, 320, 150, "Verificación pública", "verde", 14,
            sub="El QR del certificado abre /verificar/{codigo} sin iniciar sesión")
    # flechas
    lz.flecha([(400, 315), (510, 315)], etiqueta="HTTP/JSON + JWT", color="#a5b4fc", doble=True, tam=11)
    lz.flecha([(970, 635), (1040, 635), (1040, 255), (1110, 255)], etiqueta="SQL (PyMySQL)", color="#7dd3fc",
              pos_etiqueta=0.55, tam=11)
    lz.flecha([(970, 540), (1110, 525)], color="#f9a8d4")
    lz.flecha([(740, 250), (740, 270)], color="#94a3b8")
    lz.flecha([(740, 480), (740, 500)], color="#94a3b8")
    lz.flecha([(740, 580), (740, 600)], color="#94a3b8")
    lz.guardar(ruta)


def capas(ruta):
    w, h = 1300, 700
    lz = Lienzo(w, h, "Arquitectura en capas del backend", "Cada capa solo conoce a la de abajo")
    filas = [
        ("Capa de presentación", "app/routes/*.py", "azul",
         "auth · usuarios · clientes · cotizaciones · programacion · inspecciones · informes · certificados · "
         "seguimiento · catalogos · dashboard · serializers (modelo → JSON)"),
        ("Capa de seguridad", "app/security.py", "rojo",
         "Contraseñas PBKDF2-SHA256 en BLOB · tokens JWT de 12 h · require_roles(...) en cada endpoint · "
         "enlaces firmados que vencen para fotos, firmas y PDF"),
        ("Capa de negocio", "app/services/", "verde",
         "flujo.py: máquina de estados, consecutivos e historial · checklist.py: ítems que aplican y validaciones · "
         "reglas.py: reglas puras · pdf.py: informe y certificado · archivos.py"),
        ("Capa de persistencia", "app/models.py · app/database.py", "ambar",
         "SQLAlchemy 2 · una sesión por petición (get_db) · zona horaria -05:00 en cada conexión · "
         "migraciones con Alembic"),
        ("Capa de datos", "MariaDB / MySQL", "morado",
         "31 tablas, 2 vistas (v_seguimiento_equipo, v_inspeccion_item_aplica) · InnoDB con llaves foráneas"),
    ]
    y = 100
    for nombre, donde, est, desc in filas:
        relleno, borde, color = C[est]
        lz.partes.append(f'<rect x="60" y="{y}" width="{w - 120}" height="100" rx="12" fill="#18202e" '
                         f'stroke="{borde}" stroke-width="1.6"/>')
        lz.partes.append(f'<path d="M72 {y} h268 v100 h-268 a12 12 0 0 1 -12 -12 v-76 a12 12 0 0 1 12 -12 z" '
                         f'fill="{relleno}" stroke="{borde}" stroke-width="1.6"/>')
        lz.texto(200, y + 40, nombre, 16, color, True)
        lz.texto(200, y + 64, donde, 12, TENUE, italica=True)
        lz.bloque_texto(800, y + 50, partir(desc, 860, 13), 13, "#e5e7eb")
        if y > 100:
            lz.flecha([(200, y - 18), (200, y)], color="#94a3b8")
        y += 118
    lz.guardar(ruta)


def despliegue(ruta):
    w, h = 1400, 820
    lz = Lienzo(w, h, "Diagrama de despliegue", "Entorno de desarrollo y demostración")
    lz.caja(40, 100, 860, 580, "", "panel", r=16, guion=True, capa=lz.fondo)
    lz.texto(70, 126, "«device» PC de desarrollo / servidor", 15, "#93c5fd", True, anchor="start")
    lz.caja(80, 160, 360, 240, "", "gris", r=14, capa=lz.fondo)
    lz.texto(260, 184, "«execution environment» Docker", 14, "#cbd5e1", True)
    lz.caja(110, 210, 300, 110, "servilift-db", "celeste", 16, sub="«container» MariaDB 10.11 · puerto 3307 → 3306")
    lz.caja(110, 335, 300, 50, "volumen servilift-datos", "panel", 13)
    lz.caja(500, 160, 360, 110, "API ServiLift", "azul", 16, sub="«process» uv run uvicorn app.main:app · puerto 8000")
    lz.caja(500, 290, 360, 110, "Expo dev server", "teal", 16, sub="«process» npx expo start · puerto 8081")
    lz.caja(500, 420, 360, 90, "storage/", "rosa", 14, sub="«folder» fotos, firmas y PDF")
    lz.caja(80, 440, 360, 210, "", "gris", r=14, capa=lz.fondo)
    lz.texto(260, 464, "Pruebas automáticas", 14, "#cbd5e1", True)
    lz.caja(110, 490, 300, 60, "API de pruebas · puerto 8010", "panel", 13)
    lz.caja(110, 565, 300, 60, "App web de pruebas · puerto 8091", "panel", 13)
    lz.caja(980, 180, 380, 190, "Navegador", "teal", 16, sub="«device» oficina y portal del cliente")
    lz.caja(980, 400, 380, 130, "Celular del inspector", "ambar", 16,
            sub="«device» Android / iOS · Expo Go en la misma Wi‑Fi o APK de EAS Build")
    lz.caja(980, 560, 380, 90, "Lector de QR", "gris", 15, sub="«device» cualquier persona")
    lz.caja(980, 690, 380, 90, "GitHub Actions", "verde", 15,
            sub="«device» ubuntu-latest · pruebas en cada pull request")
    lz.flecha([(500, 215), (410, 260)], etiqueta="SQL", color="#7dd3fc", tam=11)
    lz.flecha([(980, 190), (860, 190)], etiqueta="HTTP :8000", color="#a5b4fc", tam=11)
    lz.flecha([(980, 345), (860, 345)], etiqueta="HTTP :8081", color="#5eead4", tam=11)
    lz.flecha([(980, 465), (925, 465), (925, 226), (860, 226)], etiqueta="HTTP :8000", color="#fcd34d", tam=11,
              pos_etiqueta=0.35)
    lz.flecha([(980, 605), (950, 605), (950, 258), (860, 258)], etiqueta="/verificar", color="#94a3b8", tam=11,
              pos_etiqueta=0.25)
    lz.flecha([(680, 400), (680, 420)], color="#f9a8d4")
    lz.guardar(ruta)


def flujo_negocio(ruta):
    """Diagrama de actividades con carriles por rol."""
    carriles = ["Asesor", "Cliente", "Programación", "Inspector", "Director técnico", "Certificados"]
    estilos = ["teal", "verde", "morado", "ambar", "rosa", "celeste"]
    cw = 250
    w = 60 + cw * len(carriles) + 40
    h = 1400
    lz = Lienzo(w, h, "Flujo del servicio de inspección", "Diagrama de actividades por rol, de la cotización al certificado")
    for i, (c, e) in enumerate(zip(carriles, estilos)):
        relleno, borde, color = C[e]
        x = 60 + i * cw
        lz.fondo.insert(0, f'<rect x="{x}" y="90" width="{cw}" height="{h - 120}" fill="#18202e" stroke="#2f3a4d"/>')
        lz.fondo.insert(1, f'<rect x="{x}" y="90" width="{cw}" height="40" fill="{relleno}" stroke="{borde}"/>')
        lz.texto(x + cw / 2, 110, c, 14, color, True)

    def cx(i):
        return 60 + i * cw + cw / 2

    def nodo(i, y, t, est="panel", alto=56):
        lz.caja(cx(i) - 105, y, 210, alto, t, est, 12.5)
        return (cx(i), y, alto)

    def fl(a, b, etq=None, color="#94a3b8"):
        (x1, y1, h1), (x2, y2, h2) = a, b
        if abs(x1 - x2) < 1:
            pts = [(x1, y1 + h1), (x2, y2)]
        else:
            ym = y1 + h1 + 14
            pts = [(x1, y1 + h1), (x1, ym), (x2, ym), (x2, y2)]
        lz.flecha(pts, color=color, etiqueta=etq, tam=11)

    def rombo(i, y, t):
        lz.rombo(cx(i), y + 45, 230, 90, t, "gris", 12.5)
        return (cx(i), y, 90)

    verde, rojo, lila = "#4ade80", "#f87171", "#c4b5fd"
    lz.partes.append(f'<circle cx="{cx(0)}" cy="160" r="12" fill="#22c55e"/>')
    lz.flecha([(cx(0), 172), (cx(0), 190)])
    a = nodo(0, 190, "Registrar cliente, edificio y equipos")
    b = nodo(0, 280, "Crear cotización y enviarla al cliente")
    fl(a, b)
    c = rombo(1, 380, "¿Aprueba la cotización?")
    fl(b, c)
    r = nodo(1, 510, "Rechazada: fin", "rojo", 44)
    fl(c, r, "No", rojo)
    d = nodo(0, 510, "Aceptar y enviar a programación")
    lz.flecha([(cx(1) - 115, 425), (cx(0), 425), (cx(0), 510)], color=verde, etiqueta="Sí", tam=11,
              pos_etiqueta=0.3)
    e = nodo(2, 610, "Asignar inspector, fecha y hora")
    fl(d, e)
    f = nodo(3, 710, "Inspección: datos, checklist, fotos y firmas (con o sin señal)", "ambar", 70)
    fl(e, f)
    g = nodo(3, 820, "Finalizar: genera el informe de la visita")
    fl(f, g)
    hh = nodo(4, 920, "Revisar informe", "rosa")
    fl(g, hh)
    nodo(3, 920, "Devuelto: corregir", "rojo", 56)
    lz.flecha([(cx(4) - 105, 948), (cx(3) + 105, 948)], color=rojo)
    lz.texto(cx(4) - 105, 910, "Devolver", 11, rojo, anchor="start")
    lz.flecha([(cx(3) - 105, 948), (cx(3) - 122, 948), (cx(3) - 122, 745), (cx(3) - 105, 745)], color=rojo)
    k = rombo(4, 1020, "¿Concepto conforme?")
    fl(hh, k)
    m = nodo(5, 1140, "Elaborar certificado con QR", "celeste")
    lz.flecha([(cx(4) + 115, 1065), (cx(5), 1065), (cx(5), 1140)], color=verde, etiqueta="Sí", tam=11,
              pos_etiqueta=0.3)
    n = nodo(5, 1230, "Enviar al cliente")
    fl(m, n)
    lz.partes.append(f'<circle cx="{cx(5)}" cy="1322" r="12" fill="none" stroke="#e5e7eb" stroke-width="2"/>'
                     f'<circle cx="{cx(5)}" cy="1322" r="7" fill="#e5e7eb"/>')
    lz.flecha([(cx(5), 1286), (cx(5), 1310)])
    p = rombo(4, 1150, "¿Era la 2ª visita?")
    fl(k, p, "No", rojo)
    s = nodo(4, 1280, "Cerrado no conforme: requiere cotización nueva", "rojo", 66)
    fl(p, s, "Sí", rojo)
    q = nodo(1, 1280, "Solicitar 2ª visita dentro del plazo", "verde")
    lz.flecha([(cx(4) - 115, 1195), (cx(1), 1195), (cx(1), 1280)], color=rojo,
              etiqueta="No: hay plazo de corrección", tam=11, pos_etiqueta=0.35)
    lz.flecha([(cx(1) + 105, 1308), (cx(2), 1308), (cx(2), 666)], color=lila, etiqueta="2ª visita",
              pos_etiqueta=0.5, tam=11)
    lz.texto(w / 2, h - 18, "Solo existen dos visitas por servicio. Cada visita tiene su informe, revisión, firma y "
             "PDF.", 12, TENUE)
    lz.guardar(ruta)


def estados(ruta):
    w, h = 1400, 900
    lz = Lienzo(w, h, "Estados de un equipo cotizado (cotizacion_equipo.estado)",
                "Transiciones principales de flujo.TRANSICIONES; un cambio no permitido responde 409")
    pos = {
        "PENDIENTE_APROBACION": (560, 100, "panel"), "RECHAZADO": (1040, 100, "rojo"),
        "APROBADO_CLIENTE": (560, 200, "panel"), "POR_PROGRAMAR": (560, 300, "panel"),
        "PROGRAMADO": (560, 400, "morado"), "EN_INSPECCION": (560, 500, "ambar"),
        "EN_REVISION": (560, 600, "rosa"), "INFORME_APROBADO": (160, 720, "verde"),
        "CERTIFICADO_LISTO": (160, 820, "verde"), "NO_CONFORME": (1040, 600, "rojo"),
        "SEGUNDA_VISITA_SOLICITADA": (1040, 400, "morado"), "CERRADO_NO_CONFORME": (560, 760, "rojo"),
        "ANULADO": (160, 300, "gris"),
    }
    bw, bh = 280, 50
    for e, (x, y, est) in pos.items():
        lz.caja(x, y, bw, bh, e, est, 13)

    def lado(e, l):
        x, y, _ = pos[e]
        return {"t": (x + bw / 2, y), "b": (x + bw / 2, y + bh), "l": (x, y + bh / 2),
                "r": (x + bw, y + bh / 2)}[l]

    def t(a, la, b, lb, etq, color="#94a3b8", medio=None, pe=0.5):
        p0, p1 = lado(a, la), lado(b, lb)
        pts = [p0] + (medio or []) + [p1]
        lz.flecha(pts, color=color, etiqueta=etq, tam=11, pos_etiqueta=pe)

    t("PENDIENTE_APROBACION", "b", "APROBADO_CLIENTE", "t", "Cliente aprueba")
    t("PENDIENTE_APROBACION", "r", "RECHAZADO", "l", "Cliente rechaza", "#f87171")
    t("APROBADO_CLIENTE", "b", "POR_PROGRAMAR", "t", "Asesor envía a programación")
    t("POR_PROGRAMAR", "b", "PROGRAMADO", "t", "Programación agenda")
    t("PROGRAMADO", "l", "POR_PROGRAMAR", "l", "Cancelada", "#fbbf24", [(520, 425), (520, 325)])
    t("PROGRAMADO", "b", "EN_INSPECCION", "t", "Inspector inicia")
    t("EN_INSPECCION", "b", "EN_REVISION", "t", "Inspector finaliza")
    t("EN_REVISION", "l", "EN_INSPECCION", "l", "Director devuelve", "#fbbf24", [(500, 625), (500, 525)])
    lz.flecha([(620, 650), (620, 690), (300, 690), (300, 720)], color="#4ade80", etiqueta="Conforme (1ª o 2ª visita)",
              tam=11, pos_etiqueta=0.45)
    lz.flecha([(840, 625), (1040, 625)], color="#f87171")
    lz.texto(940, 608, "1ª visita no conforme", 11, "#f87171")
    t("EN_REVISION", "b", "CERRADO_NO_CONFORME", "t", "2ª visita con hallazgos sin corregir", "#f87171", pe=0.45)
    t("NO_CONFORME", "t", "SEGUNDA_VISITA_SOLICITADA", "b", "Cliente o asesor solicita 2ª visita", "#c4b5fd")
    lz.flecha([(1040, 418), (840, 418)], color="#c4b5fd")
    lz.texto(940, 402, "Agenda 2ª visita", 11, "#c4b5fd")
    lz.flecha([(840, 438), (1040, 438)], color="#fbbf24")
    lz.texto(940, 454, "Cancela 2ª visita", 11, "#fbbf24")
    t("INFORME_APROBADO", "b", "CERTIFICADO_LISTO", "t", "Certificados emite y envía", "#4ade80")
    for e in ["PENDIENTE_APROBACION", "APROBADO_CLIENTE", "POR_PROGRAMAR", "PROGRAMADO"]:
        x, y, _ = pos[e]
        lz.flecha([(x, y + bh / 2), (300, y + bh / 2), (300, 350)] if e != "POR_PROGRAMAR"
                  else [(x, y + bh / 2), (440, y + bh / 2)], color="#64748b", guion=True)
    lz.texto(300, 375, "Anular (hasta PROGRAMADO)", 11, TENUE)
    leyenda(lz, 1040, 740, [("caja", "verde", "Final con certificado"), ("caja", "rojo", "No conforme / cerrado"),
                           ("caja", "morado", "Programación"), ("guion", "#64748b", "Anulación")])
    lz.guardar(ruta)


def sincronizacion(ruta):
    w, h = 1400, 900
    lz = Lienzo(w, h, "Trabajo sin señal: guardar primero en el teléfono",
                "Diagrama de secuencia de la cola de cambios del inspector")
    vidas = [("Inspector", "ambar"), ("Pantalla de inspección", "panel"), ("Cola persistente\n(offline/cola.ts)",
                                                                           "gris"),
             ("Motor de sincronización", "azul"), ("API FastAPI", "teal"), ("MariaDB", "celeste")]
    xs = [130 + i * 228 for i in range(len(vidas))]
    for x, (n, e) in zip(xs, vidas):
        lz.caja(x - 95, 100, 190, 56, n, e, 13)
        lz.fondo.append(f'<line x1="{x}" y1="156" x2="{x}" y2="{h - 40}" stroke="#475569" stroke-dasharray="4 5"/>')
    y = [190]

    def msg(a, b, t, color="#cbd5e1", guion=False):
        lz.flecha([(xs[a], y[0]), (xs[b], y[0])], color=color, guion=guion, capa="partes")
        tw = ancho(t, 12) + 12
        mx = (xs[a] + xs[b]) / 2
        lz.frente.append(f'<rect x="{mx - tw / 2:.1f}" y="{y[0] - 21:.1f}" width="{tw:.1f}" height="19" rx="4" '
                         f'fill="{C["fondo"]}"/>')
        lz.texto(mx, y[0] - 11, t, 12, color, capa=lz.frente)
        y[0] += 48

    def nota(t, est="panel"):
        lz.caja(xs[2] - 90, y[0] - 14, xs[5] - xs[2] + 180, 34, t, est, 12, negrita=False)
        y[0] += 46

    msg(0, 1, "Califica ítem, toma foto o firma")
    msg(1, 2, "Guarda la operación con hora y uuid")
    msg(2, 1, "«Guardado en el teléfono»", "#86efac", True)
    nota("El motor se activa al guardar, al volver la red, al abrir la app y cada 30 s", "gris")
    msg(3, 2, "Toma las operaciones en orden")
    lz.texto(60, y[0] - 6, "[hay señal]", 12, "#86efac", True, anchor="start")
    msg(3, 4, "PUT /inspecciones/{id}/resultados (modificado_en)", "#a5b4fc")
    msg(4, 5, "Guarda solo si es más reciente", "#7dd3fc")
    msg(4, 3, "200 OK", "#86efac", True)
    msg(3, 2, "Quita la operación de la cola", "#86efac")
    lz.texto(60, y[0] - 6, "[sin señal]", 12, "#fcd34d", True, anchor="start")
    msg(3, 3 if False else 2, "Reintenta en 3 s, 6 s, 12 s, 30 s, 60 s", "#fcd34d", True)
    lz.texto(60, y[0] - 6, "[error del servidor]", 12, "#fca5a5", True, anchor="start")
    msg(3, 2, "Marca la operación con error (no la borra)", "#fca5a5")
    msg(2, 1, "Aparece en Sincronización: reintentar o descartar", "#fca5a5", True)
    nota("Fotos y firmas llevan uuid_offline: un reenvío no se duplica. Finalizar exige la cola vacía.", "verde")
    lz.h = y[0] + 20
    lz.guardar(ruta)


def mutacion(ruta):
    """Réplica del diagrama de mutación manual que se usa en el bootcamp de pruebas."""
    w, h = 1100, 470
    lz = Lienzo(w, h, "Mutación manual: ¿mis tests detectan este defecto?")
    lz.caja(40, 120, 230, 110, "1. Muta el código", "azul", 15, sub="> por >= , borra un trim(), invierte una "
                                                                     "condición")
    lz.caja(330, 120, 230, 110, "2. Corre los tests", "panel", 15, sub="toda la suite")
    lz.rombo(740, 175, 240, 150, "¿Algún test falla?", "gris", 14)
    lz.caja(430, 330, 300, 110, "Mutante sobrevive ✗", "rojo", 15,
            sub="Falta un caso. Escribe el test que falla con la mutación.")
    lz.caja(780, 330, 290, 110, "Mutante eliminado ✓", "verde", 15,
            sub="Tus tests protegen esa regla. Deshaz la mutación.")
    lz.flecha([(270, 175), (330, 175)])
    lz.flecha([(560, 175), (620, 175)])
    lz.flecha([(740, 250), (740, 290), (580, 290), (580, 330)], color="#f87171", etiqueta="No", pos_etiqueta=0.2)
    lz.flecha([(860, 175), (925, 175), (925, 330)], color="#4ade80", etiqueta="Sí", pos_etiqueta=0.7)
    lz.flecha([(430, 385), (155, 385), (155, 230)], color="#94a3b8", guion=True, etiqueta="y vuelve a probar",
              pos_etiqueta=0.4)
    lz.guardar(ruta)


def piramide(ruta):
    w, h = 1200, 600
    lz = Lienzo(w, h, "Niveles de prueba de ServiLift", "De la base (rápidas, muchas) a la punta (lentas, pocas)")
    niveles = [
        ("E2E · Playwright", "6 pruebas + flujo completo por rol", "rosa", 340),
        ("Integración · pytest -m integracion", "Flujo completo por la API contra MariaDB", "ambar", 540),
        ("Unitarias backend · pytest", "103 pruebas · cobertura 44,7 %", "verde", 740),
        ("Unitarias app · Vitest", "110 pruebas · cobertura de líneas 42,4 %", "azul", 940),
    ]
    y = 110
    for nombre, det, est, ww in niveles:
        relleno, borde, color = C[est]
        x = (w - ww) / 2
        lz.partes.append(f'<polygon points="{x + 40},{y} {x + ww - 40},{y} {x + ww},{y + 100} {x},{y + 100}" '
                         f'fill="{relleno}" stroke="{borde}" stroke-width="1.6"/>')
        lz.texto(w / 2, y + 40, nombre, 16, color, True)
        lz.texto(w / 2, y + 66, det, 13, "#cbd5e1")
        y += 112
    lz.guardar(ruta)


def ci(ruta):
    w, h = 1300, 380
    lz = Lienzo(w, h, "Integración continua (GitHub Actions)", ".github/workflows/tests.yml en cada pull request")
    lz.caja(40, 150, 200, 90, "Pull request o push", "panel", 14, sub="main · version-2.1")
    jobs = [("frontend", "Node 22 → npm ci → npm test (Vitest + umbral)", "azul"),
            ("backend", "Python 3.13 → uv sync --locked → uv run pytest", "verde"),
            ("evidencia-individual", "Commits de pruebas por autor en la semana", "gris")]
    for i, (n, d, e) in enumerate(jobs):
        y = 100 + i * 90
        lz.caja(330, y, 380, 70, n, e, 14, sub=d)
        lz.flecha([(240, 195), (285, 195), (285, y + 35), (330, y + 35)])
        lz.flecha([(710, y + 35), (790, y + 35), (790, 195), (840, 195)])
    lz.rombo(930, 195, 180, 120, "¿Todo verde?", "gris", 13)
    lz.caja(1080, 110, 180, 70, "Se puede fusionar", "verde", 13)
    lz.caja(1080, 220, 180, 70, "Corregir y volver a subir", "rojo", 13)
    lz.flecha([(1020, 175), (1080, 145)], color="#4ade80", etiqueta="Sí", tam=11)
    lz.flecha([(1020, 215), (1080, 255)], color="#f87171", etiqueta="No", tam=11)
    lz.guardar(ruta)
