// Une lo que dice el servidor con los cambios que siguen en el teléfono (cola de sincronización),
// para que el inspector siempre vea lo último que hizo, tenga o no señal.
import { useEffect, useRef } from 'react';

import { cola, EventoEnviado, Operacion } from '@/offline/cola';

export { aplicarPendientes, resumenLocal } from '@/logica/checklistLocal';
export type { Checklist, ItemChecklist } from '@/logica/checklistLocal';

export function fotosPendientes(ops: Operacion[], idItem?: number) {
  return ops.filter((o): o is Extract<Operacion, { tipo: 'foto' }> => o.tipo === 'foto'
    && (idItem === undefined || o.campos.id_item === String(idItem)));
}

export function firmasPendientes(ops: Operacion[]) {
  return ops.filter((o): o is Extract<Operacion, { tipo: 'firma' }> => o.tipo === 'firma');
}

/** Avisa cuando un cambio de esta inspección llegó al servidor. */
export function useEnvios(idInspeccion: number, fn: (e: EventoEnviado) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => cola.alEnviar((e) => {
    if (e.op.idInspeccion === idInspeccion) ref.current(e);
  }), [idInspeccion]);
}
