import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Pruebas unitarias de la lógica de la app (sin React Native, sin red y sin teléfono).
// "npm test" corre las pruebas y mide la cobertura: si baja del umbral, el comando falla.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: [
        // Pantallas y componentes visuales: se prueban como componentes desde la semana 3
        'src/pantallas/**/*.tsx',
        'src/componentes/**',
        // Variantes solo para navegador de adaptadores del teléfono (sin lógica propia)
        'src/**/*.web.ts',
      ],
      // Línea base de la semana 1: el umbral solo puede subir (ver docs/matriz-rotacion.md)
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
  },
});
