// Estados que envía el backend: etiqueta en español y grupo de color (sin depender del tema visual).

/** Estados del backend -> etiqueta que ve el usuario. */
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

export type GrupoEstado = 'exito' | 'error' | 'alerta' | 'gris' | 'info';

/** Verde: terminado bien · rojo: rechazado o con hallazgos · naranja: esperando a alguien · gris: borrador. */
export function grupoEstado(e?: string | null): GrupoEstado {
  if (!e) return 'info';
  if (VERDES.includes(e)) return 'exito';
  if (ROJOS.includes(e)) return 'error';
  if (NARANJAS.includes(e)) return 'alerta';
  if (e === 'BORRADOR') return 'gris';
  return 'info';
}
