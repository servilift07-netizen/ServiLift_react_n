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
        // Estado de React (contextos y hooks): se prueba con los componentes en la semana 3
        'src/**/*Context.tsx',
        'src/hooks/**',
        // Adaptadores sin reglas propias: HTTP (fetch), almacenamiento del teléfono y sus variantes web.
        // La cola sin conexión (src/offline/cola.ts) SÍ se mide: es lógica de negocio (semana 5, con dobles).
        'src/api/**',
        'src/offline/almacenamiento.ts',
        'src/offline/fotosLocales*.ts',
        'src/sesion/almacen*.ts',
        // Configuración y arranque
        'src/config.ts',
        'src/navegacion.ts',
      ],
      // Semana 2: el mayor entre el piso del 30% y la cobertura real. Solo puede subir (ver docs/matriz-rotacion.md)
      thresholds: { lines: 41, branches: 61, functions: 32, statements: 43 },
    },
  },
});
