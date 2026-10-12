// Almacenamiento persistente en el teléfono (AsyncStorage; en el navegador usa localStorage).
// Sobrevive a cerrar la app, apagar el celular o quedarse sin batería.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIJO = 'servilift:';

export async function leerJSON<T>(clave: string, defecto: T): Promise<T> {
  try {
    const t = await AsyncStorage.getItem(PREFIJO + clave);
    return t ? (JSON.parse(t) as T) : defecto;
  } catch {
    return defecto;
  }
}

export async function guardarJSON(clave: string, valor: unknown): Promise<void> {
  await AsyncStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
}

export async function borrarClave(clave: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIJO + clave);
}

// ---------------------------------------------------------------------------
// Caché de lecturas: lo último que se descargó de cada pantalla (agenda, inspección,
// checklist, fotos, catálogos) para poder abrirlas sin señal.
// ---------------------------------------------------------------------------
export interface Guardado<T> {
  datos: T;
  guardadoEn: string; // ISO
}

export function leerCache<T>(clave: string): Promise<Guardado<T> | null> {
  return leerJSON<Guardado<T> | null>(`cache:${clave}`, null);
}

export async function guardarCache(clave: string, datos: unknown): Promise<void> {
  try {
    await guardarJSON(`cache:${clave}`, { datos, guardadoEn: new Date().toISOString() });
  } catch {
    // almacenamiento lleno: la pantalla sigue funcionando en línea
  }
}
