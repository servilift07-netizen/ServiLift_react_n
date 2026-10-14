// Plazo para corregir los hallazgos de la 1ª visita: nivel de urgencia y texto que ve el usuario.
import { fecha } from './formatos';

export interface DatosPlazo {
  plazo_dias?: number | null;
  fecha_limite_correccion?: string | null;
  dias_restantes?: number | null;
}

export type NivelPlazo = 'vencido' | 'urgente' | 'proximo' | 'normal';

/** vencido: menos de 0 días · urgente: 0 a 3 · próximo: 4 a 10 · normal: más de 10. */
export function nivelPlazo(dias: number): NivelPlazo {
  if (dias < 0) return 'vencido';
  if (dias <= 3) return 'urgente';
  if (dias <= 10) return 'proximo';
  return 'normal';
}

/** null cuando el equipo no tiene plazo (no hay hallazgos o ya no aplica). */
export function textoPlazo(datos: DatosPlazo): string | null {
  const dias = datos.dias_restantes;
  if (dias === null || dias === undefined) return null;
  if (datos.plazo_dias === 0) return 'Corrección inmediata (hallazgos muy graves)';
  if (dias < 0) return `Plazo vencido hace ${-dias} días (límite ${fecha(datos.fecha_limite_correccion)})`;
  return `Plazo ${datos.plazo_dias} días · vence ${fecha(datos.fecha_limite_correccion)} · quedan ${dias} días`;
}
