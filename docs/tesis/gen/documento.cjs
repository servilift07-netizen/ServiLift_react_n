// Genera docs/tesis/ServiLift_Documentacion.docx con la estructura y el estilo del documento modelo
// (normas APA, Times New Roman, tablas de requisitos y de casos de uso) y los diagramas de ../img.
// Uso: python3 datos_doc.py && NODE_PATH=$(npm root -g) node documento.cjs
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, HeadingLevel, PageBreak, Header, Footer, PageNumber, TableOfContents,
  LevelFormat, VerticalAlign, TabStopType,
} = require('docx');

const AQUI = __dirname;
const IMG = path.join(AQUI, '..', 'img');
const D = JSON.parse(fs.readFileSync(path.join(AQUI, 'contenido.json'), 'utf8'));
const SPEC = require('./especificaciones.cjs');
const SALIDA = process.argv[2] || path.join(AQUI, '..', 'ServiLift_Documentacion.docx');
const LOGO = path.join(AQUI, 'sena.png');

const FUENTE = 'Times New Roman';
const ANCHO = 9360; // 6.5 pulgadas en DXA (carta con márgenes de 1")
const NAVY = '1F3864';
const AZUL_CLARO = 'D9E2F3';
const VERDE = '4CD964';
const FECHA = '14/10/2026';
const AUTOR = 'Equipo ServiLift';

// ---------------------------------------------------------------- texto
function runs(texto, base = {}) {
  // **negrita** y `código` dentro del texto
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let i = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > i) out.push(new TextRun({ text: texto.slice(i, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: (base.size || 24) - 2, ...base, ...{ font: 'Consolas' } }));
    i = m.index + t.length;
  }
  if (i < texto.length) out.push(new TextRun({ text: texto.slice(i), ...base }));
  return out;
}
const P = (texto, opt = {}) => new Paragraph({
  children: runs(texto), indent: { firstLine: 720 }, spacing: { line: 480, after: 0 }, ...opt,
});
const Pc = (texto, opt = {}) => new Paragraph({ children: runs(texto), alignment: AlignmentType.CENTER, spacing: { line: 480 }, ...opt });
const encabezados = [];
const H1 = (t) => { encabezados.push([1, t]); return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true }); };
const H1n = (t) => { encabezados.push([1, t]); return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); };
const H2 = (t) => { encabezados.push([2, t]); return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); };
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const vineta = (t) => new Paragraph({ children: runs(t), numbering: { reference: 'vinetas', level: 0 }, spacing: { line: 360, after: 60 } });
const numerada = (t, ref) => new Paragraph({ children: runs(t), numbering: { reference: ref, level: 0 }, spacing: { line: 360, after: 60 } });
const salto = () => new Paragraph({ children: [new PageBreak()] });
let nNum = 0;
const listaNum = (items) => { const ref = `num${nNum++}`; numeraciones.push(ref); return items.map((t) => numerada(t, ref)); };
const numeraciones = [];

// ---------------------------------------------------------------- figuras y tablas APA
let nFig = 0, nTab = 0;
function figura(nombre, titulo, nota, maxAlto = 8.3) {
  nFig++;
  const [w, h] = D.imagenes[nombre];
  let ancho = 6.5, alto = (6.5 * h) / w;
  if (alto > maxAlto) { alto = maxAlto; ancho = (maxAlto * w) / h; }
  const out = [
    new Paragraph({ children: [new TextRun({ text: `Figura ${nFig}`, bold: true })], spacing: { before: 240, after: 0 }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: titulo, italics: true })], spacing: { after: 120 }, keepNext: true }),
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: !!nota,
      children: [new ImageRun({
        type: 'png', data: fs.readFileSync(path.join(IMG, `${nombre}.png`)),
        transformation: { width: Math.round(ancho * 96), height: Math.round(alto * 96) },
        altText: { title: titulo, description: titulo, name: nombre },
      })],
    }),
  ];
  if (nota) out.push(notaP(nota));
  return out;
}
const notaP = (t) => new Paragraph({ children: [new TextRun({ text: 'Nota: ', italics: true }), ...runs(t)], spacing: { before: 60, after: 240, line: 276 } });

const SIN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LINEA = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const GRIS = { style: BorderStyle.SINGLE, size: 4, color: '7F7F7F' };

function celda(contenido, ancho, o = {}) {
  const parrafos = (Array.isArray(contenido) ? contenido : [contenido]).map((c) =>
    c instanceof Paragraph ? c : new Paragraph({ keepNext: !!o.junto, keepLines: true,
      children: runs(String(c), { size: o.tam || 20, bold: o.negrita, color: o.color, italics: o.cursiva }),
      alignment: o.centro ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 240, before: 20, after: 20 },
    }));
  return new TableCell({
    children: parrafos, width: { size: ancho, type: WidthType.DXA }, columnSpan: o.span, rowSpan: o.rowSpan,
    shading: o.fondo ? { fill: o.fondo, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    borders: o.bordes, verticalAlign: o.vcentro ? VerticalAlign.CENTER : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
  });
}

// Tabla APA: líneas arriba, bajo el encabezado y abajo.
function tablaAPA(titulo, encabezados, filas, anchos, nota, tam = 20) {
  nTab++;
  const total = anchos.reduce((a, b) => a + b, 0);
  const borde = (i, n, enc) => ({ top: i === 0 && enc ? LINEA : SIN, bottom: enc || i === n - 1 ? LINEA : SIN, left: SIN, right: SIN });
  const rows = [new TableRow({
    tableHeader: true,
    children: encabezados.map((e, j) => celda(e, anchos[j], { negrita: true, tam, bordes: borde(0, 1, true) })),
  })];
  filas.forEach((f, i) => rows.push(new TableRow({
    cantSplit: true,
    children: f.map((c, j) => celda(c, anchos[j], { tam, bordes: borde(i, filas.length, false) })),
  })));
  const out = [
    new Paragraph({ children: [new TextRun({ text: `Tabla ${nTab}`, bold: true })], spacing: { before: 240 }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: titulo, italics: true })], spacing: { after: 120 }, keepNext: true }),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: anchos, rows }),
  ];
  if (nota) out.push(notaP(nota)); else out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

// Tabla con rejilla completa (diccionario de datos, matrices).
function tablaRejilla(encabezados, filas, anchos, o = {}) {
  const b = { top: GRIS, bottom: GRIS, left: GRIS, right: GRIS };
  const rows = [new TableRow({
    tableHeader: true,
    children: encabezados.map((e, j) => celda(e, anchos[j], { negrita: true, centro: true, tam: o.tam || 18, bordes: b, fondo: o.fondoEnc || 'F2F2F2', color: o.colorEnc, vcentro: true })),
  })];
  filas.forEach((f) => rows.push(new TableRow({
    cantSplit: true,
    children: f.map((c, j) => {
      const obj = typeof c === 'object' && c !== null && !Array.isArray(c) && !(c instanceof Paragraph) ? c : { t: c };
      return celda(obj.t, anchos[j], { tam: o.tam || 18, bordes: b, centro: o.centro && o.centro.includes(j), fondo: obj.fondo, negrita: obj.negrita, color: obj.color, vcentro: true });
    }),
  })));
  return new Table({ width: { size: anchos.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: anchos, rows });
}

// ---------------------------------------------------------------- tablas con el formato del documento modelo
function tablaRequisito(codigo, nombre, descripcion, rol, titulo = 'REQUISITOS FUNCIONALES', extra) {
  const b = { top: LINEA, bottom: LINEA, left: LINEA, right: LINEA };
  const w = [1300, ANCHO - 1300];
  const filasDer = [
    celda([`**Nombre:** ${nombre}`], w[1], { bordes: b, junto: true }),
    celda([`**Descripción:** ${descripcion}`], w[1], { bordes: b, junto: true }),
    celda([`**Rol:** ${rol}`], w[1], { bordes: b, junto: !!extra }),
  ];
  if (extra) filasDer.push(celda([`**${extra[0]}:** ${extra[1]}`], w[1], { bordes: b }));
  const rows = [
    new TableRow({ cantSplit: true, children: [celda('CÓDIGO', w[0], { negrita: true, fondo: VERDE, bordes: b, junto: true }), celda(titulo, w[1], { negrita: true, fondo: VERDE, bordes: b, junto: true })] }),
    new TableRow({ cantSplit: true, children: [celda(codigo, w[0], { negrita: true, rowSpan: filasDer.length, bordes: b, junto: true }), filasDer[0]] }),
    ...filasDer.slice(1).map((c) => new TableRow({ cantSplit: true, children: [c] })),
  ];
  return [new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: w, rows }), separador(200)];
}

// Párrafo mínimo tras una tabla: si la tabla llena la página, no empuja una hoja en blanco.
const separador = (alto = 0) => new Paragraph({ spacing: { before: 0, after: 0, line: alto || 20, lineRule: 'exact' }, children: [new TextRun({ text: '', size: 2 })] });

// Especificación de caso de uso: una tabla de 6 columnas.
const G = [900, 1500, 1800, 1500, 1800, 1860];
const suma = (a, b) => G.slice(a, b).reduce((x, y) => x + y, 0);
function tablaCU(id, rolCodigo) {
  const s = SPEC[id];
  const cu = D.cu[id];
  const b = { top: GRIS, bottom: GRIS, left: GRIS, right: GRIS };
  const navy = (t) => new TableRow({ children: [celda(t, ANCHO, { span: 6, fondo: NAVY, color: 'FFFFFF', negrita: true, bordes: b })] });
  const sub = (t) => new TableRow({ keepNext: true, children: [celda(t, ANCHO, { span: 6, fondo: AZUL_CLARO, negrita: true, bordes: b })] });
  const txt = (t) => new TableRow({ cantSplit: true, children: [celda(t, ANCHO, { span: 6, bordes: b })] });
  const fila = (cols) => new TableRow({ cantSplit: true, children: cols.map(([t, a, z, o]) => celda(t, suma(a, z), { span: z - a, bordes: b, ...(o || {}) })) });
  const encFlujo = fila([['Paso', 0, 1, { fondo: AZUL_CLARO, negrita: true }], ['Actor', 1, 3, { fondo: AZUL_CLARO, negrita: true }], ['Sistema', 3, 6, { fondo: AZUL_CLARO, negrita: true }]]);
  const rows = [
    navy('1. IDENTIFICACIÓN DEL CASO DE USO'),
    fila([['1.1 Id', 0, 1, { fondo: AZUL_CLARO, negrita: true }], [id, 1, 2, { negrita: true }], ['1.2 Nombre', 2, 3, { fondo: AZUL_CLARO, negrita: true }], [cu.nombre, 3, 6, { negrita: true }]]),
    navy('2. HISTÓRICO DEL CASO DE USO'),
    fila([['2.1 Autor', 0, 2, { fondo: AZUL_CLARO }], [AUTOR, 2, 3], ['2.2 Fecha', 3, 4, { fondo: AZUL_CLARO }], [FECHA, 4, 6]]),
    fila([['2.3 Versión', 0, 2, { fondo: AZUL_CLARO }], ['2.0 (implementada)', 2, 3], ['2.4 Rol', 3, 4, { fondo: AZUL_CLARO }], [rolCodigo, 4, 6]]),
    navy('3. DEFINICIÓN DEL CASO DE USO'),
    sub('3.1 Descripción'), txt(s.desc),
    fila([['3.2 Actores', 0, 2, { fondo: AZUL_CLARO, negrita: true }], [s.actores, 2, 6]]),
    sub('3.3 Precondiciones'), txt(s.pre.map((p, i) => `${i + 1}. ${p}`)),
    sub('3.4 Flujo normal'), encFlujo,
    ...s.normal.map(([a, z], i) => fila([[String(i + 1), 0, 1, { centro: true }], [a || '—', 1, 3], [z, 3, 6]])),
  ];
  if (s.alt.length) {
    rows.push(sub('3.5 Flujo alternativo'), encFlujo);
    s.alt.forEach(([p, a, z]) => rows.push(fila([[p, 0, 1, { centro: true }], [a || '—', 1, 3], [z, 3, 6]])));
  }
  if (s.exc.length) {
    rows.push(sub('3.6 Flujo excepcional'), encFlujo);
    s.exc.forEach(([p, a, z]) => rows.push(fila([[p, 0, 1, { centro: true }], [a || '—', 1, 3], [z, 3, 6]])));
  }
  rows.push(sub('3.7 Poscondiciones'), txt(s.post.map((p) => `• ${p}`)));
  rows.push(fila([['3.8 Frecuencia', 0, 2, { fondo: AZUL_CLARO, negrita: true }], [s.frec, 2, 6]]));
  rows.push(fila([['3.9 Endpoints', 0, 2, { fondo: AZUL_CLARO, negrita: true }], [s.api.map((a) => `\`${a}\``).join('  ·  '), 2, 6]]));
  return [
    new Paragraph({ children: [new TextRun({ text: `${id} ${cu.nombre}`, bold: true, italics: true })], spacing: { before: 0, after: 120 }, keepNext: true, pageBreakBefore: true }),
    new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: G, rows }),
    separador(),
  ];
}

function tituloTabla(titulo) {
  nTab++;
  return [
    new Paragraph({ children: [new TextRun({ text: `Tabla ${nTab}`, bold: true })], spacing: { before: 240 }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: titulo, italics: true })], spacing: { after: 120 }, keepNext: true }),
  ];
}

module.exports = { encabezados, tituloTabla, P, Pc, H1, H1n, H2, H3, vineta, listaNum, salto, figura, notaP, tablaAPA, tablaRejilla, tablaRequisito, tablaCU, runs, celda, D, SPEC, ANCHO, NAVY, AZUL_CLARO, VERDE, GRIS, LINEA, SIN, numeraciones, FUENTE, LOGO, SALIDA, FECHA,
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, Header, Footer, PageNumber, TableOfContents, LevelFormat, TabStopType, BorderStyle, ShadingType, PageBreak };

if (require.main === module) require('./capitulos.cjs');
