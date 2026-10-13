// Carga datos del backend sin hacer esperar al usuario:
//  · Al volver a una pantalla se muestra al instante lo último que se vio (memoria) y se actualiza por detrás.
//  · Se actualiza sola al volver a la pantalla, cada `intervalo` y después de cualquier guardado en el servidor.
//  · Al actualizar no parpadea ni pierde lo que se ve; la rueda de carga solo aparece la primera vez.
//  · Con `cache`, lo último descargado se guarda en el teléfono: la pantalla abre aunque no haya señal.
import { useFocusEffect } from 'expo-router';
import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { alCambiarDatos, ApiError } from '@/api/cliente';
import { REFRESCO_MS } from '@/config';
import { guardarCache, leerCache } from '@/offline/almacenamiento';

interface Opciones {
  intervalo?: number | null;
  cache?: string | null;
}

export interface Carga<T> {
  datos: T | undefined;
  error: string | null;
  cargando: boolean;
  /** true si lo que se ve viene del teléfono porque no se pudo actualizar */
  desdeCache: boolean;
  guardadoEn: string | null;
  recargar: () => Promise<void>;
  /** Cambia los datos en pantalla (y en la caché) sin ir al servidor */
  fijar: (fn: (d: T) => T) => void;
}

/** Lo último que mostró cada consulta durante esta sesión de la app (se pierde al cerrarla). */
const memoria = new Map<string, unknown>();

export function useCarga<T>(cargar: () => Promise<T>, deps: DependencyList, opciones: Opciones = {}): Carga<T> {
  const { intervalo = REFRESCO_MS, cache = null } = opciones;
  // Los datos se marcan con la búsqueda que los produjo: al cambiar de filtro nunca se ven los de la anterior
  const claveDeps = JSON.stringify(deps);
  // Identifica la consulta (pantalla + filtros) para recordar su último resultado
  const claveMemoria = `${cache ?? cargar.toString()}|${claveDeps}`;
  const [datos, setDatosEstado] = useState<{ clave: string; valor: T } | undefined>(() =>
    memoria.has(claveMemoria) ? { clave: claveDeps, valor: memoria.get(claveMemoria) as T } : undefined);
  const claveActual = useRef(claveDeps);
  claveActual.current = claveDeps;
  const memoriaActual = useRef(claveMemoria);
  memoriaActual.current = claveMemoria;
  const setDatos = useCallback((v: T | undefined, clave = claveActual.current) => {
    if (v !== undefined && clave === claveActual.current) memoria.set(memoriaActual.current, v);
    setDatosEstado(v === undefined ? undefined : { clave, valor: v });
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(!memoria.has(claveMemoria));
  const [desdeCache, setDesdeCache] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const fn = useRef(cargar);
  fn.current = cargar;
  const tieneDatos = useRef(memoria.has(claveMemoria));
  const ocupado = useRef<string | null>(null); // clave de la carga en curso
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    const clave = claveActual.current;
    if (ocupado.current === clave) return;
    ocupado.current = clave;
    if (!tieneDatos.current) setError(null);
    try {
      const d = await fn.current();
      if (!vivo.current || clave !== claveActual.current) return;
      tieneDatos.current = true;
      setDatos(d, clave);
      setError(null);
      setDesdeCache(false);
      if (cache) {
        setGuardadoEn(new Date().toISOString());
        void guardarCache(cache, d);
      }
    } catch (e) {
      // Si ya hay datos visibles se conservan (por ejemplo, sin señal por un momento)
      if (vivo.current && clave === claveActual.current) {
        if (tieneDatos.current) setDesdeCache(true);
        else setError(e instanceof ApiError ? e.toString() : String(e));
      }
    } finally {
      if (ocupado.current === clave) ocupado.current = null;
      if (vivo.current && clave === claveActual.current) setCargando(false);
    }
  }, [cache, setDatos]);

  useEffect(() => {
    vivo.current = true;
    let cancelado = false;
    if (memoria.has(memoriaActual.current)) {
      // Se muestra al instante lo último que se vio y se actualiza en silencio
      tieneDatos.current = true;
      setDatosEstado({ clave: claveDeps, valor: memoria.get(memoriaActual.current) as T });
      setCargando(false);
      void recargar();
    } else {
      tieneDatos.current = false;
      setDatosEstado(undefined);
      setCargando(true);
      (async () => {
        if (cache) {
          const g = await leerCache<T>(cache);
          if (g && !cancelado && !tieneDatos.current) {
            tieneDatos.current = true;
            setDatos(g.datos, claveDeps);
            setGuardadoEn(g.guardadoEn);
            setDesdeCache(true);
            setCargando(false);
          }
        }
        if (!cancelado) await recargar();
      })();
    }
    return () => {
      cancelado = true;
      vivo.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Al volver a la pantalla (por ejemplo, después de crear algo en otra) se actualiza sola
  const primeraVez = useRef(true);
  useFocusEffect(useCallback(() => {
    if (primeraVez.current) primeraVez.current = false;
    else void recargar();
  }, [recargar]));

  // Después de cualquier guardado en el servidor, las pantallas abiertas se actualizan
  useEffect(() => alCambiarDatos(() => void recargar()), [recargar]);

  useEffect(() => {
    if (!intervalo) return;
    const reloj = setInterval(() => {
      if (AppState.currentState === 'active') void recargar();
    }, intervalo);
    return () => clearInterval(reloj);
  }, [intervalo, recargar]);

  const fijar = useCallback((cambio: (d: T) => T) => {
    setDatosEstado((d) => {
      if (d === undefined) return d;
      const nuevo = cambio(d.valor);
      if (d.clave === claveActual.current) memoria.set(memoriaActual.current, nuevo);
      if (cache) void guardarCache(cache, nuevo);
      return { clave: d.clave, valor: nuevo };
    });
  }, [cache]);

  const vigentes = datos && datos.clave === claveDeps ? datos.valor : undefined;
  return { datos: vigentes, error, cargando, desdeCache, guardadoEn, recargar, fijar };
}

/** Olvida lo recordado (al entrar o salir de la sesión, para no mostrar datos de otro usuario). */
export function limpiarMemoria() {
  memoria.clear();
}
