"""Primitivas SVG con el estilo oscuro de los diagramas de la tesis.

Fondo azul noche, cajas redondeadas con borde de color, texto claro y flechas grises.
Cada diagrama se arma con un objeto Lienzo y se guarda como .svg; render.mjs lo pasa a PNG.
"""
from html import escape
from pathlib import Path

from PIL import ImageFont

FUENTE = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
FUENTE_B = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
_cache = {}


def ancho(texto: str, tam: float = 14, negrita: bool = False) -> float:
    clave = (tam, negrita)
    if clave not in _cache:
        _cache[clave] = ImageFont.truetype(FUENTE_B if negrita else FUENTE, int(tam * 10))
    return _cache[clave].getlength(texto) / 10


def partir(texto: str, max_ancho: float, tam: float = 14, negrita: bool = False) -> list[str]:
    lineas = []
    for parrafo in texto.split("\n"):
        actual = ""
        for palabra in parrafo.split():
            prueba = f"{actual} {palabra}".strip()
            if actual and ancho(prueba, tam, negrita) > max_ancho:
                lineas.append(actual)
                actual = palabra
            else:
                actual = prueba
        lineas.append(actual)
    return lineas


# Paleta: (relleno, borde, texto)
C = {
    "fondo": "#141925",
    "panel": ("#1d2432", "#2f3a4d", "#e5e7eb"),
    "azul": ("#1e2440", "#6366f1", "#eef2ff"),
    "celeste": ("#132c44", "#38bdf8", "#e0f2fe"),
    "verde": ("#123524", "#22c55e", "#dcfce7"),
    "rojo": ("#4a1414", "#ef4444", "#fee2e2"),
    "ambar": ("#3d2c0c", "#f59e0b", "#fef3c7"),
    "morado": ("#2a1d45", "#a855f7", "#f3e8ff"),
    "teal": ("#0f3534", "#14b8a6", "#ccfbf1"),
    "rosa": ("#3f1530", "#ec4899", "#fce7f3"),
    "gris": ("#232a38", "#4b5563", "#e5e7eb"),
}
TEXTO = "#f3f4f6"
TENUE = "#9ca3af"
LINEA = "#94a3b8"


class Lienzo:
    def __init__(self, w, h, titulo=None, subtitulo=None):
        self.w, self.h = w, h
        self.fondo = []
        self.partes = []
        self.frente = []
        self.titulo, self.subtitulo = titulo, subtitulo

    # ---------- básicos ----------
    def texto(self, x, y, t, tam=14, color=TEXTO, negrita=False, anchor="middle", italica=False, capa=None):
        peso = "600" if negrita else "400"
        estilo = ' font-style="italic"' if italica else ""
        (capa if capa is not None else self.partes).append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{tam}" fill="{color}" font-weight="{peso}"{estilo} '
            f'text-anchor="{anchor}" dominant-baseline="central">{escape(t)}</text>')

    def bloque_texto(self, cx, cy, lineas, tam=14, color=TEXTO, negrita=False, interlinea=1.3, capa=None):
        alto = tam * interlinea
        y0 = cy - alto * (len(lineas) - 1) / 2
        for i, l in enumerate(lineas):
            self.texto(cx, y0 + i * alto, l, tam, color, negrita, capa=capa)

    def caja(self, x, y, w, h, texto="", estilo="panel", tam=14, negrita=True, sub=None, r=10, guion=False,
             grosor=1.6, capa=None):
        relleno, borde, color = C[estilo]
        dash = ' stroke-dasharray="6 4"' if guion else ""
        (capa if capa is not None else self.partes).append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{relleno}" stroke="{borde}" '
            f'stroke-width="{grosor}"{dash}/>')
        lineas = partir(texto, w - 20, tam, negrita) if texto else []
        sub_l = partir(sub, w - 20, tam - 2) if sub else []
        alto_t = len(lineas) * tam * 1.3 + (len(sub_l) * (tam - 2) * 1.3 + 4 if sub_l else 0)
        y0 = y + h / 2 - alto_t / 2
        for i, l in enumerate(lineas):
            self.texto(x + w / 2, y0 + tam * 0.65 + i * tam * 1.3, l, tam, color, negrita, capa=capa)
        for i, l in enumerate(sub_l):
            self.texto(x + w / 2, y0 + len(lineas) * tam * 1.3 + 4 + (tam - 2) * 0.65 + i * (tam - 2) * 1.3, l,
                       tam - 2, TENUE, capa=capa)
        return (x, y, w, h)

    def elipse(self, cx, cy, rx, ry, texto, estilo="celeste", tam=13, negrita=True):
        relleno, borde, color = C[estilo]
        self.partes.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{relleno}" stroke="{borde}" '
                           f'stroke-width="1.6"/>')
        self.bloque_texto(cx, cy, partir(texto, rx * 1.55, tam, negrita), tam, color, negrita)

    def rombo(self, cx, cy, w, h, texto, estilo="gris", tam=13):
        relleno, borde, color = C[estilo]
        pts = f"{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}"
        self.partes.append(f'<polygon points="{pts}" fill="{relleno}" stroke="{borde}" stroke-width="1.6"/>')
        self.bloque_texto(cx, cy, partir(texto, w * 0.55, tam, True), tam, color, True)

    def flecha(self, puntos, color=LINEA, guion=False, etiqueta=None, pos_etiqueta=0.5, punta=True, grosor=1.6,
               color_etiqueta=None, doble=False, tam=12, capa="fondo"):
        d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in puntos)
        dash = ' stroke-dasharray="6 5"' if guion else ""
        mid = _id_marcador(color)
        fin = f' marker-end="url(#{mid})"' if punta else ""
        ini = f' marker-start="url(#{mid}i)"' if doble else ""
        destino = self.fondo if capa == "fondo" else self.partes
        destino.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{grosor}"{dash}{fin}{ini}/>')
        if etiqueta:
            x, y = _punto_en(puntos, pos_etiqueta)
            w = ancho(etiqueta, tam) + 12
            self.frente.append(f'<rect x="{x - w / 2:.1f}" y="{y - 10:.1f}" width="{w:.1f}" height="20" rx="4" '
                               f'fill="#18202e" opacity="0.95"/>')
            self.texto(x, y, etiqueta, tam, color_etiqueta or color, capa=self.frente)

    def actor(self, x, y, nombre, color="#e5e7eb"):
        s = (f'<g stroke="{color}" stroke-width="2.2" fill="none">'
             f'<circle cx="{x}" cy="{y - 38}" r="13"/>'
             f'<line x1="{x}" y1="{y - 25}" x2="{x}" y2="{y + 12}"/>'
             f'<line x1="{x - 24}" y1="{y - 12}" x2="{x + 24}" y2="{y - 12}"/>'
             f'<line x1="{x}" y1="{y + 12}" x2="{x - 18}" y2="{y + 42}"/>'
             f'<line x1="{x}" y1="{y + 12}" x2="{x + 18}" y2="{y + 42}"/></g>')
        self.partes.append(s)
        for i, l in enumerate(partir(nombre, 150, 14, True)):
            self.texto(x, y + 60 + i * 18, l, 14, TEXTO, True)

    def svg(self) -> str:
        cab = []
        top = 0
        if self.titulo:
            cab.append(f'<text x="{self.w / 2}" y="34" font-size="22" font-weight="700" fill="{TEXTO}" '
                       f'text-anchor="middle" dominant-baseline="central">{escape(self.titulo)}</text>')
            top = 30
        if self.subtitulo:
            cab.append(f'<text x="{self.w / 2}" y="62" font-size="14" fill="{TENUE}" text-anchor="middle" '
                       f'dominant-baseline="central">{escape(self.subtitulo)}</text>')
        defs = "".join(_marcadores.values())
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" font-family="Inter, sans-serif">'
                f'<defs>{defs}</defs>'
                f'<rect width="{self.w}" height="{self.h}" rx="14" fill="{C["fondo"]}"/>'
                + "".join(cab) + "".join(self.fondo) + "".join(self.partes) + "".join(self.frente) + "</svg>")

    def guardar(self, ruta: Path):
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(self.svg(), encoding="utf-8")


_marcadores = {}


def _id_marcador(color):
    mid = "m" + color.strip("#")
    if mid not in _marcadores:
        _marcadores[mid] = (
            f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
            f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>'
            f'<marker id="{mid}i" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
            f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>')
    return mid


def _punto_en(puntos, t):
    import math
    segs = [(puntos[i], puntos[i + 1]) for i in range(len(puntos) - 1)]
    largos = [math.dist(a, b) for a, b in segs]
    total = sum(largos)
    objetivo = total * t
    for (a, b), l in zip(segs, largos):
        if objetivo <= l and l > 0:
            f = objetivo / l
            return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        objetivo -= l
    return puntos[-1]


def leyenda(lz: Lienzo, x, y, items, tam=12):
    """items: lista de (tipo, estilo, texto). tipo: 'caja' | 'elipse' | 'flecha' | 'guion'."""
    for i, (tipo, estilo, t) in enumerate(items):
        yy = y + i * 26
        if tipo == "caja":
            relleno, borde, _ = C[estilo]
            lz.partes.append(f'<rect x="{x}" y="{yy - 8}" width="30" height="16" rx="4" fill="{relleno}" '
                             f'stroke="{borde}" stroke-width="1.5"/>')
        elif tipo == "elipse":
            relleno, borde, _ = C[estilo]
            lz.partes.append(f'<ellipse cx="{x + 15}" cy="{yy}" rx="15" ry="8" fill="{relleno}" stroke="{borde}" '
                             f'stroke-width="1.5"/>')
        else:
            lz.flecha([(x, yy), (x + 30, yy)], color=estilo, guion=(tipo == "guion"), capa="partes")
        lz.texto(x + 40, yy, t, tam, TENUE, anchor="start")
