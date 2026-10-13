// Cliente HTTP del backend ServiLift (FastAPI).
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { API_URL } from '@/config';

/** Error con el mensaje "detail" que devuelve FastAPI. status 0 = sin conexión. */
export class ApiError extends Error {
  status: number;
  pendientes: string[];

  constructor(status: number, mensaje: string, pendientes: string[] = []) {
    super(mensaje);
    this.status = status;
    this.pendientes = pendientes;
  }

  get sinConexion(): boolean {
    return this.status === 0 || this.status >= 502;
  }

  toString(): string {
    return this.pendientes.length ? `${this.message}:\n• ${this.pendientes.join('\n• ')}` : this.message;
  }
}

let token: string | null = null;

// Aviso de "algo cambió en el servidor": tras cada guardado exitoso las pantallas abiertas se
// actualizan solas (agrupado para no repetir consultas cuando se guardan varias cosas seguidas).
const oyentesCambio = new Set<() => void>();
let relojCambio: ReturnType<typeof setTimeout> | null = null;

export function alCambiarDatos(fn: () => void) {
  oyentesCambio.add(fn);
  return () => {
    oyentesCambio.delete(fn);
  };
}

function avisarCambio() {
  if (relojCambio) clearTimeout(relojCambio);
  relojCambio = setTimeout(() => oyentesCambio.forEach((fn) => fn()), 400);
}
let alExpirarSesion: (() => void) | null = null;

export function fijarToken(t: string | null) {
  token = t;
}

export function obtenerToken() {
  return token;
}

export function alExpirar(fn: () => void) {
  alExpirarSesion = fn;
}

export function url(path: string): string {
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function conQuery(path: string, query?: Query): string {
  const partes = Object.entries(query ?? {})
    .filter(([, v]) => v !== null && v !== undefined && `${v}` !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return url(path) + (partes.length ? `?${partes.join('&')}` : '');
}

async function procesar(res: Response): Promise<any> {
  const texto = await res.text();
  if (res.ok) return texto ? JSON.parse(texto) : null;
  if (res.status === 401 && token) alExpirarSesion?.();
  let mensaje = `Error ${res.status}`;
  let pendientes: string[] = [];
  try {
    const detalle = JSON.parse(texto)?.detail;
    if (typeof detalle === 'string') mensaje = detalle;
    else if (detalle && !Array.isArray(detalle)) {
      mensaje = detalle.mensaje ?? mensaje;
      pendientes = detalle.pendientes ?? [];
    } else if (Array.isArray(detalle) && detalle.length) {
      // Errores de validación de FastAPI
      mensaje = detalle.map((e: any) => `${e.loc?.[e.loc.length - 1]}: ${e.msg}`).join('\n');
    }
  } catch {
    // respuesta sin JSON
  }
  throw new ApiError(res.status, mensaje, pendientes);
}

async function pedir(metodo: string, path: string, opciones: { body?: unknown; query?: Query; form?: FormData; timeoutMs?: number } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), opciones.timeoutMs ?? 30000);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: any;
  if (opciones.form) body = opciones.form;
  else if (opciones.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opciones.body);
  }
  let res: Response;
  try {
    res = await fetch(conQuery(path, opciones.query), { method: metodo, headers, body, signal: control.signal });
  } catch {
    throw new ApiError(0, `Sin conexión con el servidor (${API_URL})`);
  } finally {
    clearTimeout(reloj);
  }
  const datos = await procesar(res);
  if (metodo !== 'GET') avisarCambio();
  return datos;
}

export interface ArchivoLocal {
  uri: string;
  nombre: string;
  tipo?: string;
}

export const Api = {
  get: (path: string, query?: Query) => pedir('GET', path, { query }),
  post: (path: string, body?: unknown) => pedir('POST', path, { body: body ?? {} }),
  put: (path: string, body?: unknown) => pedir('PUT', path, { body: body ?? {} }),
  delete: (path: string) => pedir('DELETE', path),

  /** Sube una o varias fotos (campo "archivos") con campos de formulario adicionales. */
  async subirFotos(path: string, archivos: ArchivoLocal[], campos: Record<string, string | undefined> = {}) {
    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null) form.append(k, v);
    for (const a of archivos) {
      if (Platform.OS === 'web') {
        const blob = await (await fetch(a.uri)).blob();
        form.append('archivos', blob, a.nombre);
      } else {
        form.append('archivos', { uri: a.uri, name: a.nombre, type: a.tipo ?? 'image/jpeg' } as any);
      }
    }
    return pedir('POST', path, { form, timeoutMs: 180000 });
  },

  /** Pide al backend un enlace temporal y abre el PDF en el navegador / visor. */
  async abrirPdf(pathEnlace: string) {
    const d = await pedir('GET', pathEnlace);
    const destino = url(d.url);
    if (Platform.OS === 'web') window.open(destino, '_blank');
    else await WebBrowser.openBrowserAsync(destino);
  },
};
