import { expect, test } from '@playwright/test';
import {
  aprobarInforme, aprobarYEnviarAProgramacion, abrirInforme, certificarYEnviar, comprobarPdf, cotizarYEnviar,
  crearEdificio, ingresar, inspeccionar, menu, programar, unico,
} from './utilidades/ui.js';

// Camino principal: la 1ª visita queda conforme y sale el certificado. Cada paso lo hace el rol que corresponde:
// asesor (edificio, ascensor y cotización) -> cliente (aprueba) -> asesor (envía a programación) -> programación
// (agenda la visita) -> inspector (datos, variantes, checklist, foto y firmas) -> director técnico (aprueba y
// firma) -> certificados (elabora y envía) -> cliente (ve el informe y el certificado en Mis equipos).
// Usa el cliente de datos iniciales (database/03_datos_iniciales.sql) y crea un edificio nuevo en cada corrida.

const EDIFICIO = unico('Torre E2E');
const ASCENSOR = 'Ascensor 1';

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);
test.use({ actionTimeout: 20_000 });

let numeroCotizacion = '';

test('1. el asesor registra el edificio y el ascensor y envía la cotización al cliente', async ({ page }) => {
  await crearEdificio(page, EDIFICIO, 1);
  numeroCotizacion = await cotizarYEnviar(page, [ASCENSOR]);
});

test('2. el cliente aprueba la cotización y el asesor la envía a programación', async ({ page }) => {
  await aprobarYEnviarAProgramacion(page, numeroCotizacion);
});

test('3. programación agenda la visita y el inspector recibe el aviso', async ({ page }) => {
  await programar(page, numeroCotizacion, EDIFICIO);
  await ingresar(page, 'inspector@gmail.com');
  await page.getByLabel('Notificaciones').click();
  await expect(page.getByText(new RegExp(numeroCotizacion)).filter({ visible: true }).first()).toBeVisible();
});

test('4. el inspector diligencia la inspección y la envía al director técnico', async ({ page }) => {
  await ingresar(page, 'inspector@gmail.com');
  await inspeccionar(page, EDIFICIO, ASCENSOR);
});

test('5. el director técnico aprueba y firma el informe conforme', async ({ page }) => {
  await abrirInforme(page, EDIFICIO, ASCENSOR);
  await aprobarInforme(page, 'Pasa a Certificados para emitir el certificado.');
});

test('6. certificados elabora el certificado y lo envía al cliente', async ({ page }) => {
  await certificarYEnviar(page, EDIFICIO);
});

test('7. el cliente ve el informe y descarga el certificado de su ascensor', async ({ page }) => {
  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Mis equipos');
  const fila = page.locator('div').filter({ hasText: numeroCotizacion }).filter({ hasText: ASCENSOR })
    .filter({ has: page.getByRole('button', { name: /^Certificado/ }) }).last();
  await expect(fila.getByRole('button', { name: /Informe 1ª visita/ })).toBeVisible();
  await comprobarPdf(page, fila.getByRole('button', { name: /^Certificado/ }));
});
