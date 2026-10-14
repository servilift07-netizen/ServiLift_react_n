// ---------------------------------------------------------------------------
// Formatos. El backend envía las fechas en hora de Colombia (…-05:00): se muestran
// tal cual llegan, sin depender de la zona horaria configurada en el dispositivo.
// ---------------------------------------------------------------------------
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;
const RE_HORA = /T(\d{2}):(\d{2})/;

export function fecha(v?: string | null): string {
  const m = v ? RE_FECHA.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v || '-';
}

export function fechaHora(v?: string | null): string {
  if (!v) return '-';
  const h = RE_HORA.exec(v);
  return h ? `${fecha(v)} ${h[1]}:${h[2]}` : fecha(v);
}

export function hora(v?: string | null): string {
  return v && v.length >= 5 ? v.slice(0, 5) : v || '-';
}

export function moneda(v: unknown): string {
  const n = Math.round(Number(v) || 0);
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}$ ${s}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
  'noviembre', 'diciembre'];

/** '2026-10-12' -> 'lunes 12 de octubre' */
export function fechaLarga(v?: string | null): string {
  const m = v ? RE_FECHA.exec(v) : null;
  if (!m) return v || '-';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** Fecha local del dispositivo en formato del API (AAAA-MM-DD). */
export function fechaApi(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** hoy se recibe por parámetro para que las pruebas no dependan del reloj. */
export function esHoy(v?: string | null, hoy: Date = new Date()): boolean {
  return !!v && v.slice(0, 10) === fechaApi(hoy);
}

/** Fecha-hora generada en el dispositivo (ISO UTC) mostrada en la hora del dispositivo. */
export function fechaHoraLocal(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
