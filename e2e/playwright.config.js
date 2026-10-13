import { defineConfig, devices } from '@playwright/test';

// Puertos propios de las pruebas: no chocan con el backend (8000) ni con Expo (8081) del día a día.
const frontPort = Number(process.env.FRONT_PORT ?? 8091);
const apiPort = Number(process.env.API_PORT ?? 8010);

// El backend se levanta con uv (usa el .venv y el uv.lock del backend). Con PYTHON se puede usar otro intérprete.
const backend = process.env.PYTHON ? `"${process.env.PYTHON}" -m uvicorn` : 'uv run uvicorn';

export default defineConfig({
  testDir: './tests',
  // Expo compila la app web la primera vez que se abre: los tests esperan un poco más que el valor por defecto.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${frontPort}`,
    // Guarda la traza solo cuando un test falla y se reintenta: se abre con "pnpm report"
    trace: 'on-first-retry',
    locale: 'es-CO',
  },
  // Lista en la terminal + reporte HTML que se abre con "pnpm report"
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Playwright levanta el backend contra la BASE DE PRUEBAS (nunca servilift_db) y la app web de Expo.
  // La base servilift_v2_prueba se crea con database/01_schema.sql, 02_seed.sql y 03_datos_iniciales.sql.
  webServer: [
    {
      command: `${backend} app.main:app --port ${apiPort}`,
      cwd: '../servilift-backend',
      url: `http://localhost:${apiPort}/`,
      env: { DB_NAME: process.env.DB_NAME ?? 'servilift_v2_prueba' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Se lanza el CLI de Expo con node, sin npx de por medio, para que Playwright pueda detenerlo al terminar.
      command: `node node_modules/expo/bin/cli start --port ${frontPort}`,
      cwd: '../servilift-app',
      url: `http://localhost:${frontPort}`,
      env: { EXPO_PUBLIC_API_URL: `http://localhost:${apiPort}`, CI: '1', BROWSER: 'none' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
