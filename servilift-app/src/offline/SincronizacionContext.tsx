// Motor de sincronización: vigila la conexión y envía la cola cuando hay señal.
// Se dispara al guardar algo, al recuperar la conexión, al volver a abrir la app y cada 30 s.
import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSesion } from '@/sesion/SesionContext';
import { cola, Operacion } from './cola';

interface Estado {
  enLinea: boolean;
  enviando: boolean;
  operaciones: Operacion[];
  /** Cambios guardados en el teléfono que aún no llegan al servidor */
  pendientes: number;
  conError: number;
  ultimaSincronizacion: string | null;
  sincronizar: () => void;
  pendientesDe: (idInspeccion: number) => Operacion[];
}

const Contexto = createContext<Estado | null>(null);

const ESPERAS = [3000, 6000, 12000, 30000, 60000]; // reintentos sin señal

export function SincronizacionProvider({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const [ultima, setUltima] = useState<string | null>(null);
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallos = useRef(0);

  const sincronizar = useCallback(() => {
    if (reintento.current) {
      clearTimeout(reintento.current);
      reintento.current = null;
    }
    // No se confía solo en el indicador de red del sistema (a veces dice "sin internet" con datos activos):
    // se intenta y, si falla por conexión, se reintenta más tarde.
    if (cola.enviando || !cola.todas().some((o) => !o.error)) return;
    void cola.enviar().then((r) => {
      if (r === 'ok') {
        fallos.current = 0;
        setUltima(new Date().toISOString());
      } else if (r === 'sin_conexion') {
        // Se vuelve a intentar con esperas crecientes (sin gastar batería en reintentos seguidos)
        const espera = ESPERAS[Math.min(fallos.current, ESPERAS.length - 1)];
        fallos.current += 1;
        reintento.current = setTimeout(sincronizar, espera);
      }
      // 'sesion': la sesión venció; la cola queda guardada y sigue al volver a ingresar
    });
  }, []);

  // Cola del usuario actual
  useEffect(() => {
    void cola.abrir(usuario?.id_usuario ?? null).then(sincronizar);
  }, [usuario?.id_usuario, sincronizar]);

  useEffect(() => {
    const quitar = cola.suscribir(() => {
      setOperaciones([...cola.todas()]);
      setEnviando(cola.enviando);
    });
    return quitar;
  }, []);

  // Cada cambio guardado intenta salir de inmediato (con una pequeña espera para agrupar varios toques)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(sincronizar, 800);
  }, [operaciones.length, sincronizar]);

  useEffect(() => {
    const quitarRed = NetInfo.addEventListener((s) => {
      const ok = !!s.isConnected && s.isInternetReachable !== false;
      setEnLinea(ok);
      if (ok) {
        fallos.current = 0;
        sincronizar();
      }
    });
    const quitarApp = AppState.addEventListener('change', (e) => {
      if (e === 'active') sincronizar();
    });
    const reloj = setInterval(sincronizar, 30000);
    return () => {
      quitarRed();
      quitarApp.remove();
      clearInterval(reloj);
    };
  }, [sincronizar]);

  const valor = useMemo<Estado>(() => ({
    enLinea,
    enviando,
    operaciones,
    pendientes: operaciones.length,
    conError: operaciones.filter((o) => o.error).length,
    ultimaSincronizacion: ultima,
    sincronizar,
    pendientesDe: (id: number) => operaciones.filter((o) => o.idInspeccion === id),
  }), [enLinea, enviando, operaciones, ultima, sincronizar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSincronizacion(): Estado {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSincronizacion fuera de SincronizacionProvider');
  return s;
}
