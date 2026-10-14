import { describe, expect, it } from 'vitest';

import { nivelPlazo, textoPlazo } from '@/logica/plazo';

describe('nivelPlazo', () => {
  it.each([
    [-1, 'vencido'],
    [0, 'urgente'], // borde entre vencido y urgente
    [3, 'urgente'], // borde superior de urgente
    [4, 'proximo'],
    [10, 'proximo'], // borde superior de próximo
    [11, 'normal'],
    [180, 'normal'],
  ])('should classify %d remaining days as %s', (dias, nivel) => {
    expect(nivelPlazo(dias)).toBe(nivel);
  });
});

describe('textoPlazo', () => {
  it('should return null when the equipment has no correction deadline', () => {
    expect(textoPlazo({ plazo_dias: null, dias_restantes: null })).toBeNull();
    expect(textoPlazo({})).toBeNull();
  });

  it('should ask for immediate correction when the deadline is zero days', () => {
    // Arrange: hallazgo muy grave (plazo 0)
    const datos = { plazo_dias: 0, fecha_limite_correccion: '2026-10-12', dias_restantes: 0 };

    // Act
    const texto = textoPlazo(datos);

    // Assert
    expect(texto).toBe('Corrección inmediata (hallazgos muy graves)');
  });

  it('should show how many days ago the deadline expired', () => {
    const datos = { plazo_dias: 30, fecha_limite_correccion: '2026-10-01', dias_restantes: -5 };

    expect(textoPlazo(datos)).toBe('Plazo vencido hace 5 días (límite 01/10/2026)');
  });

  it('should show the deadline and the remaining days when it is still open', () => {
    const datos = { plazo_dias: 180, fecha_limite_correccion: '2027-04-10', dias_restantes: 179 };

    expect(textoPlazo(datos)).toBe('Plazo 180 días · vence 10/04/2027 · quedan 179 días');
  });
});
