import { expect, test } from '@playwright/test';
import {
  abrirCotizacion, aprobarYEnviarAProgramacion, confirmar, cotizarYEnviar, crearEdificio, escribirYAceptar,
  elegirDelMenu, ingresar, menu, programar, pulsarIconoDeTarjeta, unico,
} from './utilidades/ui.js';

// Caminos del proceso que no terminan en una inspección: cotización rechazada o anulada, y visita reprogramada
// y cancelada (el equipo vuelve a la bandeja de programación).

test.setTimeout(180_000);
test.use({ actionTimeout: 20_000 });

test('el cliente rechaza la cotización con un motivo y el asesor lo ve', async ({ page }) => {
  const edificio = unico('Torre Rechazo');
  await crearEdificio(page, edificio, 1);
  const numero = await cotizarYEnviar(page, ['Ascensor 1']);

  await abrirCotizacion(page, 'cliente@gmail.com', numero);
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await escribirYAceptar(page, 'Motivo', 'El valor supera el presupuesto');
  await expect(page.getByText('Cotización rechazada')).toBeVisible();

  await abrirCotizacion(page, 'asesor@gmail.com', numero);
  await expect(page.getByText('El valor supera el presupuesto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceptar y enviar a programación' })).toHaveCount(0);
});

test('el asesor anula una cotización en borrador y el cliente nunca la ve', async ({ page }) => {
  const edificio = unico('Torre Anulada');
  await crearEdificio(page, edificio, 1);
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  await page.getByRole('checkbox', { name: 'Ascensor 1' }).click();
  await page.getByText('Valor', { exact: true }).last().locator('xpath=ancestor::div[.//input][1]').locator('input').first().fill('450000');
  await page.getByRole('button', { name: 'Crear cotización' }).click();
  const numero = (await page.getByText(/^COT-/).first().textContent()).trim();
  await page.getByRole('button', { name: 'Anular', exact: true }).click();
  await escribirYAceptar(page, 'Motivo', 'Cotización duplicada');
  await expect(page.getByText('Cotización anulada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar al cliente' })).toHaveCount(0);

  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Cotizaciones');
  await expect(page.getByText(numero)).toHaveCount(0);
});

test('programación reprograma y luego cancela la visita, y el equipo vuelve a Por programar', async ({ page }) => {
  const edificio = unico('Torre Agenda');
  await crearEdificio(page, edificio, 1);
  const numero = await cotizarYEnviar(page, ['Ascensor 1']);
  await aprobarYEnviarAProgramacion(page, numero);
  await programar(page, numero, edificio);

  await menu(page, 'Calendario');
  await pulsarIconoDeTarjeta(page, `${numero} · ${edificio}`, page.getByTestId('menu-item-title').first());
  await elegirDelMenu(page, 'Reprogramar');
  await expect(page.getByText('Reprogramar visita')).toBeVisible();
  await page.getByText('Motivo del cambio *', { exact: true }).last()
    .locator('xpath=ancestor::div[.//textarea or .//input][1]').locator('textarea, input').first().fill('El cliente pidió otro horario');
  await confirmar(page, 'Reprogramar');
  await expect(page.getByText('Visita reprogramada')).toBeVisible();

  await pulsarIconoDeTarjeta(page, `${numero} · ${edificio}`, page.getByTestId('menu-item-title').first());
  await elegirDelMenu(page, 'Cancelar');
  await escribirYAceptar(page, 'Motivo', 'El edificio no tiene acceso esa semana');
  await expect(page.getByText('Visita cancelada')).toBeVisible();

  await menu(page, 'Por programar');
  await expect(page.locator('div').filter({ hasText: `${numero} · ${edificio}` })
    .filter({ hasText: 'Primera visita' }).getByRole('button', { name: 'Programar', exact: true }).first()).toBeVisible();
});
