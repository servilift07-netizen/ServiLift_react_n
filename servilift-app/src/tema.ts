import { MD3LightTheme } from 'react-native-paper';

import { grupoEstado } from './logica/estados';

/** Paleta (misma familia de colores de la versión Flutter). */
export const Colores = {
  acento: '#0066CC',
  navy: '#0B1929',
  superficie: '#F4F7FA',
  borde: '#E2E8F0',
  gris: '#6B7A8C',
  exito: '#0E7C4A',
  alerta: '#C97B1A',
  error: '#C0392B',
  info: '#2F6FB0',
  blanco: '#FFFFFF',
};

export const tema = {
  ...MD3LightTheme,
  roundness: 10,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colores.acento,
    error: Colores.error,
    background: Colores.superficie,
    surface: Colores.blanco,
  },
};

/** Estados del backend -> color (la etiqueta y el grupo viven en src/logica/estados.ts). */
export { etiqueta } from './logica/estados';

export function colorEstado(e?: string | null): string {
  return Colores[grupoEstado(e)];
}

/** Colores con nombre que envía el backend en el tablero. */
export function colorNombre(nombre?: string | null, i = 0): string {
  const paleta = ['#2F6FB0', '#0E7C4A', '#C97B1A', '#C0392B', '#6B4FA0', '#1B998B', '#8C5E3C', '#6B7A8C'];
  switch (nombre) {
    case 'info': return Colores.info;
    case 'exito': return Colores.exito;
    case 'alerta': return Colores.alerta;
    case 'error': return Colores.error;
    case 'gris': return Colores.gris;
    default: return paleta[i % paleta.length];
  }
}

export function aclarar(hex: string, alfa = 0.12): string {
  const a = Math.round(alfa * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

// Formatos de fecha, hora y moneda: viven en src/logica/formatos.ts (sin React Native, se prueban solos).
export * from './logica/formatos';
