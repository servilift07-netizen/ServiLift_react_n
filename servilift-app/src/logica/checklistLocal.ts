// Checklist que ve el inspector: lo que dice el servidor + los cambios que siguen en la cola del teléfono.
// Sin React ni almacenamiento: solo datos de entrada y de salida.
import type { Operacion } from '@/offline/cola';

export interface ItemChecklist {
  id_item: number;
  numero: number;
  descripcion: string;
  criterio_cumplimiento?: string | null;
  calificacion: string;
  calificacion_corta: string;
  requiere_medicion: boolean;
  unidad_medida?: string | null;
  aplica: boolean;
  resultado: null | {
    resultado: string;
    calificacion_defecto?: string | null;
    no_aplica_automatico?: boolean;
    valor_medido?: string | null;
    unidad_medida?: string | null;
    observacion?: string | null;
    hallazgo_director?: boolean;
    estado_segunda_visita?: string | null;
    observacion_segunda_visita?: string | null;
  };
  fotos: any[];
  /** true si el valor mostrado todavía no llega al servidor */
  pendiente?: boolean;
}

export interface Checklist {
  id_inspeccion: number;
  norma: string;
  numero_visita: number;
  categorias: { id_categoria: number; codigo: string; nombre: string; items: ItemChecklist[] }[];
}

/** marcar=false: el cambio ya llegó al servidor y se incorpora a los datos guardados. */
export function aplicarPendientes(c: Checklist, ops: Operacion[], marcar = true): Checklist {
  const res = new Map<number, Record<string, unknown>>();
  const seg = new Map<number, Record<string, unknown>>();
  for (const op of ops) {
    if (op.tipo === 'resultados') Object.values(op.items).forEach((x) => res.set(x.id_item, x as any));
    if (op.tipo === 'segunda') Object.values(op.items).forEach((x) => seg.set(x.id_item, x as any));
  }
  if (!res.size && !seg.size) return c;
  return {
    ...c,
    categorias: c.categorias.map((cat) => ({
      ...cat,
      items: cat.items.map((it) => {
        const r = res.get(it.id_item);
        const s = seg.get(it.id_item);
        if (!r && !s) return it;
        const base = it.resultado ?? { resultado: 'NO_VERIFICADO' };
        const nuevo: any = { ...base };
        if (r) {
          Object.assign(nuevo, {
            resultado: r.resultado, valor_medido: r.valor_medido, unidad_medida: r.unidad_medida,
            observacion: r.observacion, no_aplica_automatico: false,
            calificacion_defecto: r.resultado === 'NO_CUMPLE' ? it.calificacion : null,
          });
        }
        if (s) Object.assign(nuevo, { estado_segunda_visita: s.estado_segunda_visita, observacion_segunda_visita: s.observacion_segunda_visita });
        return { ...it, resultado: nuevo, pendiente: marcar };
      }),
    })),
  };
}

export function resumenLocal(c: Checklist) {
  const r = { total: 0, calificados: 0, leves: 0, graves: 0, muy_graves: 0, no_aplica: 0, no_cumple: 0, corregidos: 0, no_corregidos: 0 };
  for (const cat of c.categorias) {
    for (const it of cat.items) {
      r.total += 1;
      const x = it.resultado;
      if (!x || x.resultado === 'NO_VERIFICADO') continue;
      r.calificados += 1;
      if (x.resultado === 'NO_APLICA') r.no_aplica += 1;
      if (x.resultado === 'NO_CUMPLE') {
        r.no_cumple += 1;
        if (it.calificacion === 'LEVE') r.leves += 1;
        else if (it.calificacion === 'GRAVE') r.graves += 1;
        else r.muy_graves += 1;
        if (x.estado_segunda_visita === 'CORREGIDO') r.corregidos += 1;
        if (x.estado_segunda_visita === 'NO_CORREGIDO') r.no_corregidos += 1;
      }
    }
  }
  return r;
}
