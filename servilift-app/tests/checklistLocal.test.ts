import { describe, expect, it } from 'vitest';

import { aplicarPendientes, Checklist, conNoAplica, ItemChecklist, resumenLocal } from '@/logica/checklistLocal';
import type { Operacion } from '@/offline/cola';

// Datos de prueba: armados a mano, sin servidor ni teléfono
function item(id: number, calificacion: string, resultado: ItemChecklist['resultado'] = null): ItemChecklist {
  return {
    id_item: id, numero: id, descripcion: `Ítem ${id}`, calificacion, calificacion_corta: calificacion[0],
    requiere_medicion: false, aplica: true, resultado, fotos: [],
  };
}

function checklist(items: ItemChecklist[]): Checklist {
  return { id_inspeccion: 7, norma: 'NTC 5926-1:2012', numero_visita: 1,
    categorias: [{ id_categoria: 1, codigo: 'CAB', nombre: 'Cabina', items }] };
}

const base = { idInspeccion: 7, creada: '2026-10-12T10:00:00Z', intentos: 0, descripcion: 'cambio' };

function opResultados(items: Record<number, { id_item: number; resultado: string; observacion?: string }>): Operacion {
  const conHora = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { ...v, modificado_en: '2026-10-12T10:00:00Z' }]));
  return { ...base, id: 'op-r', tipo: 'resultados', items: conHora };
}

describe('aplicarPendientes', () => {
  it('should return the same checklist when there are no pending changes in the phone', () => {
    // Arrange
    const c = checklist([item(1, 'LEVE')]);

    // Act
    const resultado = aplicarPendientes(c, []);

    // Assert: mismo objeto, sin copias innecesarias
    expect(resultado).toBe(c);
  });

  it('should show the pending result of the phone and mark it as not yet synchronized', () => {
    // Arrange
    const c = checklist([item(1, 'GRAVE', { resultado: 'CUMPLE' }), item(2, 'LEVE')]);
    const ops = [opResultados({ 1: { id_item: 1, resultado: 'NO_CUMPLE', observacion: 'Cable desgastado' } })];

    // Act
    const nuevo = aplicarPendientes(c, ops);

    // Assert
    const [i1, i2] = nuevo.categorias[0].items;
    expect(i1.resultado).toMatchObject({ resultado: 'NO_CUMPLE', observacion: 'Cable desgastado', calificacion_defecto: 'GRAVE' });
    expect(i1.pendiente).toBe(true);
    expect(i2).toBe(c.categorias[0].items[1]); // el ítem sin cambios no se toca
  });

  it('should clear the defect rating when the pending result is not a finding', () => {
    const c = checklist([item(1, 'GRAVE', { resultado: 'NO_CUMPLE', calificacion_defecto: 'GRAVE' })]);

    const nuevo = aplicarPendientes(c, [opResultados({ 1: { id_item: 1, resultado: 'CUMPLE' } })]);

    expect(nuevo.categorias[0].items[0].resultado).toMatchObject({ resultado: 'CUMPLE', calificacion_defecto: null });
  });

  it('should merge the second visit state and not mark it when the change already reached the server', () => {
    const c = checklist([item(3, 'LEVE', { resultado: 'NO_CUMPLE', calificacion_defecto: 'LEVE' })]);
    const segunda: Operacion = { ...base, id: 'op-s', tipo: 'segunda',
      items: { 3: { id_item: 3, estado_segunda_visita: 'CORREGIDO', modificado_en: '2026-10-12T10:00:00Z' } } };

    const nuevo = aplicarPendientes(c, [segunda], false);

    const i3 = nuevo.categorias[0].items[0];
    expect(i3.resultado).toMatchObject({ resultado: 'NO_CUMPLE', estado_segunda_visita: 'CORREGIDO' });
    expect(i3.pendiente).toBe(false);
  });
});

describe('resumenLocal', () => {
  it('should count findings by rating, not applicable and corrected items', () => {
    // Arrange
    const c = checklist([
      item(1, 'LEVE', { resultado: 'NO_CUMPLE', estado_segunda_visita: 'CORREGIDO' }),
      item(2, 'GRAVE', { resultado: 'NO_CUMPLE', estado_segunda_visita: 'NO_CORREGIDO' }),
      item(3, 'MUY_GRAVE', { resultado: 'NO_CUMPLE' }),
      item(4, 'LEVE', { resultado: 'NO_APLICA' }),
      item(5, 'LEVE', { resultado: 'CUMPLE' }),
      item(6, 'LEVE', { resultado: 'NO_VERIFICADO' }),
      item(7, 'LEVE'),
    ]);

    // Act
    const r = resumenLocal(c);

    // Assert
    expect(r).toEqual({ total: 7, calificados: 5, leves: 1, graves: 1, muy_graves: 1, no_aplica: 1, no_cumple: 3,
      corregidos: 1, no_corregidos: 1 });
  });
});

describe('conNoAplica', () => {
  const noAplica = (id: number, resultado: ItemChecklist['resultado'] = null): ItemChecklist => ({ ...item(id, 'LEVE', resultado), aplica: false });

  it('should show N/A already selected on items that do not apply and are not rated', () => {
    // Arrange: sin resultado y con NO_VERIFICADO (el inspector quitó la calificación)
    const c = checklist([noAplica(1), noAplica(2, { resultado: 'NO_VERIFICADO', observacion: 'nota' }), item(3, 'LEVE')]);

    // Act
    const items = conNoAplica(c).categorias[0].items;

    // Assert
    expect(items[0].resultado).toMatchObject({ resultado: 'NO_APLICA', no_aplica_automatico: true });
    expect(items[1].resultado).toMatchObject({ resultado: 'NO_APLICA', observacion: 'nota' });
    expect(items[2].resultado).toBeNull();  // el que aplica sigue pendiente
    expect(resumenLocal(conNoAplica(c)).no_aplica).toBe(2);
  });

  it('should keep what the inspector rated on an item that does not apply', () => {
    const c = checklist([noAplica(1, { resultado: 'CUMPLE' }), noAplica(2, { resultado: 'NO_CUMPLE' })]);

    // Mismo objeto: no hay nada que precargar
    expect(conNoAplica(c)).toBe(c);
  });
});
