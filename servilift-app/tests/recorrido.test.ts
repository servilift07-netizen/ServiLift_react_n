import { describe, expect, it } from 'vitest';

import { numeroParametro, RECORRIDO_POR_DEFECTO, recorridoEstimado } from '@/logica/recorrido';

describe('recorridoEstimado', () => {
  it('should multiply the stops by the meters per stop and add the overtravel', () => {
    // Arrange: ejemplo de la plantilla del informe (12 paradas x 2,2 m + 2,5 m)
    const paradas = '12';

    // Act
    const recorrido = recorridoEstimado(paradas, 2.2, 2.5);

    // Assert
    expect(recorrido).toBe('28.9');
  });

  it.each([
    // Valores límite de "paradas > 0": 0 es el borde inválido, 1 el primer válido
    ['0', ''],
    ['1', '4.7'],
    ['2', '6.9'],
  ])('should return %j -> %j at the boundary of a positive number of stops', (paradas, esperado) => {
    expect(recorridoEstimado(paradas, 2.2, 2.5)).toBe(esperado);
  });

  it.each([[''], ['   '], ['-3'], ['doce'], ['\t']])(
    'should return an empty string when the stops are %j',
    (paradas) => {
      expect(recorridoEstimado(paradas, 2.2, 2.5)).toBe('');
    },
  );

  it('should accept a decimal comma as typed on a Colombian keyboard', () => {
    expect(recorridoEstimado(' 10,0 ', 2.2, 2.5)).toBe('24.5');
  });
});

describe('numeroParametro', () => {
  it.each([
    ['2.2', 2.2],
    ['2,2', 2.2],
    ['0', 0], // borde: el 0 es válido (parámetro mayor o igual a 0)
  ])('should read the system parameter %j as %d', (valor, esperado) => {
    expect(numeroParametro(valor, 99)).toBe(esperado);
  });

  it.each([[undefined], [''], ['-0.1'], ['abc']])(
    'should fall back to the default value when the parameter is %j',
    (valor) => {
      expect(numeroParametro(valor, RECORRIDO_POR_DEFECTO.porParada)).toBe(2.2);
    },
  );
});
