import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { alExpirar, Api, ApiError, fijarToken } from '@/api/cliente';
import { limpiarMemoria } from '@/hooks/useCarga';
import * as almacen from './almacen';

/** Roles (tabla rol.codigo del backend). */
export const Rol = {
  admin: 'ADMIN',
  asesor: 'ASESOR',
  cliente: 'CLIENTE',
  programacion: 'PROGRAMACION',
  inspector: 'INSPECTOR',
  director: 'DIRECTOR_TECNICO',
  certificados: 'CERTIFICADOS',
} as const;

export interface Usuario {
  id_usuario: number;
  nombre_completo: string;
  correo: string;
  rol: string;
  rol_nombre?: string;
  id_cliente?: number | null;
  tiene_firma?: boolean;
}

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  rol: string;
  /** true si el usuario tiene el rol indicado o es administrador */
  es: (rol: string) => boolean;
  entrar: (correo: string, contrasena: string) => Promise<string | null>;
  salir: () => Promise<void>;
}

const K_TOKEN = 'servilift_token';
const K_USUARIO = 'servilift_usuario';

const Contexto = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const salir = useCallback(async () => {
    fijarToken(null);
    limpiarMemoria();
    setUsuario(null);
    await almacen.borrar(K_TOKEN);
    await almacen.borrar(K_USUARIO);
  }, []);

  useEffect(() => {
    alExpirar(() => {
      void salir();
    });
    (async () => {
      const token = await almacen.leer(K_TOKEN);
      const guardado = await almacen.leer(K_USUARIO);
      if (token && guardado) {
        fijarToken(token);
        setUsuario(JSON.parse(guardado));
        try {
          const yo = await Api.get('/auth/me'); // valida que el token siga vigente
          setUsuario(yo);
          await almacen.guardar(K_USUARIO, JSON.stringify(yo));
        } catch (e) {
          // Sin señal se conserva la sesión guardada (el inspector puede seguir trabajando);
          // si el servidor respondió que el token no sirve, se cierra.
          if (!(e instanceof ApiError) || !e.sinConexion) await salir();
        }
      }
      setCargando(false);
    })();
  }, [salir]);

  const entrar = useCallback(async (correo: string, contrasena: string) => {
    try {
      const d = await Api.post('/auth/login', { correo: correo.trim(), contrasena });
      fijarToken(d.access_token);
      limpiarMemoria();
      await almacen.guardar(K_TOKEN, d.access_token);
      await almacen.guardar(K_USUARIO, JSON.stringify(d.usuario));
      setUsuario(d.usuario);
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'No hay conexión con el servidor';
    }
  }, []);

  const valor = useMemo<Sesion>(() => ({
    usuario,
    cargando,
    rol: usuario?.rol ?? '',
    es: (r: string) => usuario?.rol === r || usuario?.rol === Rol.admin,
    entrar,
    salir,
  }), [usuario, cargando, entrar, salir]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion fuera de SesionProvider');
  return s;
}
