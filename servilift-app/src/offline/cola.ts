// Cola de cambios pendientes ("bandeja de salida") del inspector.
//
// Cada cambio hecho en campo se guarda PRIMERO en el teléfono y después se envía al servidor.
// Si no hay señal, espera; cuando vuelve la conexión se envía solo, en orden.
//
// Reglas para no dañar datos:
//  · Todo queda en almacenamiento persistente antes de intentar enviarlo (si se cierra la app no se pierde).
//  · Los cambios del checklist se agrupan por ítem: solo viaja el último valor, con la hora en que se hizo.
//    El servidor ignora un envío más viejo que lo que ya tiene (el cambio más reciente gana).
//  · Fotos y firmas llevan un uuid: si el envío se repite (señal intermitente) el servidor no las duplica.
//  · Un error del servidor (no de conexión) NO borra el cambio: queda marcado para que el inspector
//    lo revise y decida reintentar o descartar.
import * as Crypto from 'expo-crypto';

import { Api, ApiError } from '@/api/cliente';
import { guardarJSON, leerJSON } from './almacenamiento';
import { borrarFotoLocal } from './fotosLocales';

export interface ResultadoPendiente {
  id_item: number;
  resultado: string;
  valor_medido?: string | null;
  unidad_medida?: string | null;
  observacion?: string | null;
  modificado_en: string;
}

export interface SegundaPendiente {
  id_item: number;
  estado_segunda_visita: string;
  observacion_segunda_visita?: string | null;
  modificado_en: string;
}

interface Base {
  id: string;
  idInspeccion: number;
  creada: string;
  intentos: number;
  error?: string;      // error del servidor que impide enviarlo (requiere revisión)
  descripcion: string; // texto para mostrar al usuario
}

export type Operacion =
  | (Base & { tipo: 'resultados'; items: Record<number, ResultadoPendiente> })
  | (Base & { tipo: 'segunda'; items: Record<number, SegundaPendiente> })
  | (Base & { tipo: 'put'; clave: string; path: string; body: unknown })
  | (Base & { tipo: 'foto'; uuid: string; uri: string; nombre: string; campos: Record<string, string> })
  | (Base & { tipo: 'firma'; uuid: string; body: Record<string, unknown> })
  | (Base & { tipo: 'borrar_foto'; idFoto: number });

/** Omit que respeta cada variante de la unión */
type SinControl<T> = T extends unknown ? Omit<T, 'id' | 'creada' | 'intentos'> : never;

export interface EventoEnviado {
  op: Operacion;
  respuesta: any;
}

type Oyente = () => void;

function nuevoId() {
  return Crypto.randomUUID();
}

export function uuid() {
  return Crypto.randomUUID();
}

class Cola {
  private ops: Operacion[] = [];
  private clave: string | null = null;
  private enviandoId: string | null = null;
  private escritura: Promise<void> = Promise.resolve();
  private oyentes = new Set<Oyente>();
  private oyentesEnvio = new Set<(e: EventoEnviado) => void>();

  /** Carga la cola del usuario (cada usuario tiene la suya en el teléfono). */
  async abrir(idUsuario: number | null) {
    this.clave = idUsuario ? `cola:${idUsuario}` : null;
    this.ops = this.clave ? await leerJSON<Operacion[]>(this.clave, []) : [];
    this.avisar();
  }

  todas(): Operacion[] {
    return this.ops;
  }

  pendientes(idInspeccion?: number): Operacion[] {
    return idInspeccion === undefined ? this.ops : this.ops.filter((o) => o.idInspeccion === idInspeccion);
  }

  get enviando() {
    return this.enviandoId !== null;
  }

  suscribir(fn: Oyente) {
    this.oyentes.add(fn);
    return () => {
      this.oyentes.delete(fn);
    };
  }

  alEnviar(fn: (e: EventoEnviado) => void) {
    this.oyentesEnvio.add(fn);
    return () => {
      this.oyentesEnvio.delete(fn);
    };
  }

  private avisar() {
    this.oyentes.forEach((fn) => fn());
  }

  /** Guarda la cola en el teléfono (las escrituras se encadenan para no pisarse). */
  private persistir(): Promise<void> {
    const clave = this.clave;
    const copia = JSON.parse(JSON.stringify(this.ops));
    this.escritura = this.escritura.then(() => (clave ? guardarJSON(clave, copia) : undefined)).catch(() => undefined);
    return this.escritura;
  }

  /** Busca una operación agrupable que todavía no se está enviando. */
  private agrupable<T extends Operacion['tipo']>(tipo: T, idInspeccion: number, clave?: string) {
    return this.ops.find((o) => o.tipo === tipo && o.idInspeccion === idInspeccion && o.id !== this.enviandoId
      && !o.error && (clave === undefined || (o as any).clave === clave)) as Extract<Operacion, { tipo: T }> | undefined;
  }

  async resultado(idInspeccion: number, item: ResultadoPendiente) {
    const op = this.agrupable('resultados', idInspeccion);
    if (op) op.items[item.id_item] = item;
    else {
      this.ops.push({ id: nuevoId(), tipo: 'resultados', idInspeccion, items: { [item.id_item]: item },
        creada: new Date().toISOString(), intentos: 0, descripcion: 'Resultados del checklist' });
    }
    await this.persistir();
    this.avisar();
  }

  async segunda(idInspeccion: number, item: SegundaPendiente) {
    const op = this.agrupable('segunda', idInspeccion);
    if (op) op.items[item.id_item] = item;
    else {
      this.ops.push({ id: nuevoId(), tipo: 'segunda', idInspeccion, items: { [item.id_item]: item },
        creada: new Date().toISOString(), intentos: 0, descripcion: 'Cierre de hallazgos (2ª visita)' });
    }
    await this.persistir();
    this.avisar();
  }

  /** PUT donde solo importa el último valor (datos del informe, del ascensor, variantes, instrumentos). */
  async put(idInspeccion: number, clave: string, path: string, body: unknown, descripcion: string) {
    const op = this.agrupable('put', idInspeccion, clave);
    if (op) op.body = body;
    else {
      this.ops.push({ id: nuevoId(), tipo: 'put', idInspeccion, clave, path, body, creada: new Date().toISOString(),
        intentos: 0, descripcion });
    }
    await this.persistir();
    this.avisar();
  }

  async agregar(op: SinControl<Extract<Operacion, { tipo: 'foto' | 'firma' | 'borrar_foto' }>>) {
    this.ops.push({ ...op, id: nuevoId(), creada: new Date().toISOString(), intentos: 0 } as Operacion);
    await this.persistir();
    this.avisar();
  }

  /** Descarta un cambio (solo cuando el usuario lo decide). */
  async descartar(id: string) {
    const op = this.ops.find((o) => o.id === id);
    if (!op || op.id === this.enviandoId) return;
    if (op.tipo === 'foto') borrarFotoLocal(op.uri);
    this.ops = this.ops.filter((o) => o.id !== id);
    await this.persistir();
    this.avisar();
  }

  async reintentar(id: string) {
    const op = this.ops.find((o) => o.id === id);
    if (op) {
      delete op.error;
      await this.persistir();
      this.avisar();
    }
  }

  /**
   * Envía en orden todo lo que se pueda. Se detiene al primer error de conexión (se reintenta luego).
   * Devuelve 'ok' | 'sin_conexion' | 'sesion'.
   */
  async enviar(): Promise<'ok' | 'sin_conexion' | 'sesion'> {
    if (this.enviandoId) return 'ok';
    for (;;) {
      const op = this.ops.find((o) => !o.error);
      if (!op) return 'ok';
      this.enviandoId = op.id;
      this.avisar();
      try {
        const respuesta = await ejecutar(op);
        this.ops = this.ops.filter((o) => o.id !== op.id);
        if (op.tipo === 'foto') borrarFotoLocal(op.uri);
        await this.persistir();
        this.oyentesEnvio.forEach((fn) => fn({ op, respuesta }));
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, String(e));
        op.intentos += 1;
        if (err.sinConexion) {
          await this.persistir();
          return 'sin_conexion';
        }
        if (err.status === 401) return 'sesion';
        op.error = err.toString();
        await this.persistir();
      } finally {
        this.enviandoId = null;
        this.avisar();
      }
    }
  }
}

async function ejecutar(op: Operacion): Promise<any> {
  const base = `/inspecciones/${op.idInspeccion}`;
  switch (op.tipo) {
    case 'resultados':
      return Api.put(`${base}/resultados`, Object.values(op.items));
    case 'segunda':
      return Api.put(`${base}/segunda-visita`, Object.values(op.items));
    case 'put':
      return Api.put(op.path, op.body);
    case 'foto':
      return Api.subirFotos(`${base}/fotos`, [{ uri: op.uri, nombre: op.nombre }], { ...op.campos, uuid_offline: op.uuid });
    case 'firma':
      return Api.post(`${base}/firmas`, { ...op.body, uuid_offline: op.uuid });
    case 'borrar_foto':
      return Api.delete(`${base}/fotos/${op.idFoto}`);
  }
}

export const cola = new Cola();
