import { MD3LightTheme } from 'react-native-paper';

/** Paleta (misma familia de colores de la versión Flutter). */
export const Colores = {
  acento: '#0066CC',
  navy: '#0B1929',
  superficie: '#F4F7FA',
  borde: '#E2E8F0',
  gris: '#6B7A8C',
  exito: '#0E7C4A',
  alerta: '#C97B1A',
  error: '#C0392B',
  info: '#2F6FB0',
  blanco: '#FFFFFF',
};

export const tema = {
  ...MD3LightTheme,
  roundness: 10,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colores.acento,
    error: Colores.error,
    background: Colores.superficie,
    surface: Colores.blanco,
  },
};

/** Estados del backend -> etiqueta y color. */
const ETIQUETAS: Record<string, string> = {
  PENDIENTE_APROBACION: 'Pendiente por aprobación',
  APROBADO_CLIENTE: 'Aprobado',
  POR_PROGRAMAR: 'Por programar',
  PROGRAMADO: 'Programado',
  EN_INSPECCION: 'En inspección',
  EN_REVISION: 'En revisión técnica',
  NO_CONFORME: 'No conforme: solicitar 2ª visita',
  SEGUNDA_VISITA_SOLICITADA: '2ª visita solicitada',
  INFORME_APROBADO: 'Informe disponible',
  CERTIFICADO_LISTO: 'Certificado listo',
  CERRADO_NO_CONFORME: 'No conforme en 2ª visita: requiere cotización nueva',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
  // cotización
  BORRADOR: 'Borrador',
  ENVIADA_CLIENTE: 'Enviada al cliente',
  APROBADA_CLIENTE: 'Aprobada por el cliente',
  RECHAZADA_CLIENTE: 'Rechazada por el cliente',
  ENVIADA_PROGRAMACION: 'En programación',
  EN_EJECUCION: 'En ejecución',
  FINALIZADA: 'Finalizada',
  ANULADA: 'Anulada',
  // inspección / informe / certificado
  EN_CURSO: 'En curso',
  DEVUELTA: 'Devuelta',
  APROBADA: 'Aprobada',
  EN_SEGUNDA_VISITA: 'En segunda visita',
  CERRADA: 'Cerrada',
  PENDIENTE_REVISION: 'Pendiente de revisión',
  DEVUELTO: 'Devuelto',
  APROBADO: 'Aprobado',
  CONFORME: 'Conforme',
  EMITIDO: 'Emitido',
  ENVIADO_CLIENTE: 'Enviado al cliente',
  CORREGIDO: 'Corregido',
  NO_CORREGIDO: 'No corregido',
  // programación
  PROGRAMADA: 'Programada',
  REPROGRAMADA: 'Reprogramada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  // firmantes y servicios
  INSPECTOR: 'Inspector',
  TECNICO_MANTENIMIENTO: 'Técnico de mantenimiento',
  REPRESENTANTE_EDIFICIO: 'Representante del edificio',
  INSPECCION_PERIODICA: 'Inspección periódica',
  INSPECCION_INICIAL: 'Inspección inicial',
  REINSPECCION: 'Reinspección',
  EXTRAORDINARIA: 'Extraordinaria',
};

export function etiqueta(e?: string | null): string {
  if (!e) return '';
  return ETIQUETAS[e] ?? e.replace(/_/g, ' ');
}

const VERDES = ['CERTIFICADO_LISTO', 'INFORME_APROBADO', 'APROBADO_CLIENTE', 'APROBADA_CLIENTE', 'APROBADO', 'FINALIZADA',
  'ENVIADO_CLIENTE', 'CONFORME', 'CORREGIDO', 'REALIZADA', 'APROBADA', 'CERRADA'];
const ROJOS = ['RECHAZADO', 'RECHAZADA_CLIENTE', 'ANULADO', 'ANULADA', 'NO_CONFORME', 'DEVUELTO', 'DEVUELTA',
  'CERRADO_NO_CONFORME', 'NO_CORREGIDO', 'CANCELADA'];
const NARANJAS = ['PENDIENTE_APROBACION', 'ENVIADA_CLIENTE', 'POR_PROGRAMAR', 'SEGUNDA_VISITA_SOLICITADA',
  'PENDIENTE_REVISION', 'EN_REVISION', 'EN_SEGUNDA_VISITA', 'REPROGRAMADA'];

export function colorEstado(e?: string | null): string {
  if (!e) return Colores.info;
  if (VERDES.includes(e)) return Colores.exito;
  if (ROJOS.includes(e)) return Colores.error;
  if (NARANJAS.includes(e)) return Colores.alerta;
  if (e === 'BORRADOR') return Colores.gris;
  return Colores.info;
}

/** Colores con nombre que envía el backend en el tablero. */
export function colorNombre(nombre?: string | null, i = 0): string {
  const paleta = ['#2F6FB0', '#0E7C4A', '#C97B1A', '#C0392B', '#6B4FA0', '#1B998B', '#8C5E3C', '#6B7A8C'];
  switch (nombre) {
    case 'info': return Colores.info;
    case 'exito': return Colores.exito;
    case 'alerta': return Colores.alerta;
    case 'error': return Colores.error;
    case 'gris': return Colores.gris;
    default: return paleta[i % paleta.length];
  }
}

export function aclarar(hex: string, alfa = 0.12): string {
  const a = Math.round(alfa * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

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

export function esHoy(v?: string | null): boolean {
  return !!v && v.slice(0, 10) === fechaApi(new Date());
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
