import { describe, expect, it, vi } from 'vitest';

// react-native-paper no corre en Node: se reemplaza por un tema mínimo, solo para poder importar tema.ts
vi.mock('react-native-paper', () => ({ MD3LightTheme: { colors: {} } }));

const { aclarar, colorEstado, colorNombre, Colores } = await import('@/tema');

describe('colorEstado', () => {
  it('should use the error color for an equipment closed as non conforming', () => {
    expect(colorEstado('CERRADO_NO_CONFORME')).toBe(Colores.error);
  });

  it('should use the success color for a ready certificate', () => {
    expect(colorEstado('CERTIFICADO_LISTO')).toBe(Colores.exito);
  });
});

describe('colorNombre', () => {
  it.each([
    ['info', Colores.info],
    ['exito', Colores.exito],
    ['alerta', Colores.alerta],
    ['error', Colores.error],
    ['gris', Colores.gris],
  ])('should map the dashboard color name %j to the app palette', (nombre, color) => {
    expect(colorNombre(nombre)).toBe(color);
  });

  it('should cycle through the chart palette when the name is unknown', () => {
    // Borde: la paleta tiene 8 colores, el índice 8 vuelve al primero
    expect(colorNombre(null, 8)).toBe(colorNombre(null, 0));
    expect(colorNombre(null, 1)).not.toBe(colorNombre(null, 0));
  });
});

describe('aclarar', () => {
  it.each([
    [0, '#0066CC00'],
    [0.12, '#0066CC1f'],
    [1, '#0066CCff'],
  ])('should add the transparency %d as a two digit hex suffix', (alfa, esperado) => {
    expect(aclarar('#0066CC', alfa)).toBe(esperado);
  });
});
