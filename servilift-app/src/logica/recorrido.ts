// Recorrido aproximado: metros por parada x paradas + sobre recorrido (12 x 2,2 + 2,5 = 28,9 m).
// Los dos valores son parámetros del sistema (Administración > Parámetros); estos son los de respaldo.
export const RECORRIDO_POR_DEFECTO = { porParada: 2.2, sobreRecorrido: 2.5 };
/** Valor numérico de un parámetro del sistema; si falta, no es número o es negativo, se usa el respaldo. */
export function numeroParametro(v: string | undefined, respaldo: number): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return v && Number.isFinite(n) && n >= 0 ? n : respaldo;
}
export function recorridoEstimado(paradas: string, porParada: number, sobreRecorrido: number): string {
  const n = Number(paradas.trim().replace(',', '.'));
  if (!paradas.trim() || !Number.isFinite(n) || n <= 0) return '';
  return String(Math.round((n * porParada + sobreRecorrido) * 10) / 10);
}
