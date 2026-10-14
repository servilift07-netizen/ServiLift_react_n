import { describe, expect, it } from 'vitest';

import { etiqueta, grupoEstado } from '@/logica/estados';

describe('etiqueta', () => {
  it('should translate a backend state into the text the user reads', () => {
    expect(etiqueta('CERRADO_NO_CONFORME')).toBe('No conforme en 2ª visita: requiere cotización nueva');
  });

  it('should replace underscores when the state has no label yet', () => {
    expect(etiqueta('ESTADO_NUEVO_DEL_BACKEND')).toBe('ESTADO NUEVO DEL BACKEND');
  });

  it.each([[null], [undefined], ['']])('should return an empty text when the state is %j', (e) => {
    expect(etiqueta(e)).toBe('');
  });
});

describe('grupoEstado', () => {
  it.each([
    ['CERTIFICADO_LISTO', 'exito'],
    ['CORREGIDO', 'exito'],
    ['NO_CONFORME', 'error'],
    ['CERRADO_NO_CONFORME', 'error'],
    ['NO_CORREGIDO', 'error'],
    ['SEGUNDA_VISITA_SOLICITADA', 'alerta'],
    ['POR_PROGRAMAR', 'alerta'],
    ['BORRADOR', 'gris'],
    ['PROGRAMADO', 'info'],
    [null, 'info'],
  ])('should paint %j with the %s color group', (estado, grupo) => {
    expect(grupoEstado(estado)).toBe(grupo);
  });
});
