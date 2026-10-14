import { expect, test } from '@playwright/test';
import {
  API, abrirCotizacion, abrirInforme, aprobarInforme, aprobarYEnviarAProgramacion, botonDeEquipo, campo,
  certificarYEnviar, comprobarPdf, confirmar, cotizarYEnviar, crearEdificio, escribirYAceptar, ingresar,
  enviadoAlDirector, inspeccionar, menu, programar, recogerFirmas, subirFoto, tarjeta, tokenApi, unico,
} from './utilidades/ui.js';

// Camino con hallazgos, de punta a punta por pantallas. Un edificio con dos ascensores:
//  · Ascensor 1: 1ª visita no conforme -> el director la devuelve -> el inspector corrige -> no conforme ->
//    el cliente pide la 2ª visita -> hallazgo corregido -> certificado -> verificación pública por QR -> anulación.
//  · Ascensor 2: 1ª visita no conforme (parte calificada sin señal) -> el asesor pide la 2ª visita -> hallazgo
//    sin corregir -> cerrado no conforme -> el asesor crea la cotización nueva para ese equipo.

const EDIFICIO = unico('Torre 2V');
const A1 = 'Ascensor 1';
const A2 = 'Ascensor 2';

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);
test.use({ actionTimeout: 20_000 });

let numeroCotizacion = '';

test('1. el asesor cotiza los dos ascensores y programación agenda la 1ª visita', async ({ page }) => {
  await crearEdificio(page, EDIFICIO, 2);
  numeroCotizacion = await cotizarYEnviar(page, [A1, A2]);
  await aprobarYEnviarAProgramacion(page, numeroCotizacion);
  await programar(page, numeroCotizacion, EDIFICIO);
});

test('2. el inspector registra un hallazgo con foto en cada ascensor, parte de ellos sin señal', async ({ page }) => {
  await ingresar(page, 'inspector@gmail.com');
  await inspeccionar(page, EDIFICIO, A1, { noCumple: 1 });
  await inspeccionar(page, EDIFICIO, A2, { noCumple: 1, sinSenal: true });
});

test('3. el director devuelve el informe del ascensor 1 y el inspector lo corrige', async ({ page }) => {
  await abrirInforme(page, EDIFICIO, A1);
  await page.getByRole('button', { name: 'Devolver', exact: true }).click();
  await escribirYAceptar(page, 'Qué debe corregir', 'Agregar foto del foso');
  await expect(page.getByText('Informe devuelto al inspector')).toBeVisible();

  await ingresar(page, 'inspector@gmail.com');
  await menu(page, 'Mi agenda');
  await (await botonDeEquipo(page, EDIFICIO, A1, 'Corregir')).click();
  await expect(page.getByText('Devuelto por el director: Agregar foto del foso')).toBeVisible();
  await page.getByRole('button', { name: 'Fotos', exact: true }).click();
  await subirFoto(page, page.getByText('Agregar fotos'), 'foso.jpg');
  await page.getByRole('button', { name: 'Finalizar inspección' }).click();
  await confirmar(page, 'Finalizar');
  await enviadoAlDirector(page);
});

test('4. el director aprueba los dos informes de 1ª visita como no conformes', async ({ page }) => {
  for (const equipo of [A1, A2]) {
    await abrirInforme(page, EDIFICIO, equipo);
    await aprobarInforme(page, 'El certificado queda bloqueado: el cliente o el asesor solicitan la segunda visita dentro del plazo.');
  }
});

test('5. el cliente pide la 2ª visita del ascensor 1 y el asesor la del ascensor 2', async ({ page }) => {
  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Mis equipos');
  await (await botonDeEquipo(page, numeroCotizacion, A1, 'Solicitar segunda visita')).click();
  await escribirYAceptar(page, 'Comentario (ej. hallazgos corregidos el 10/10)', 'Hallazgo corregido por el mantenimiento');
  await expect(page.getByText('Segunda visita solicitada. Programación fue notificada.')).toBeVisible();

  await abrirCotizacion(page, 'asesor@gmail.com', numeroCotizacion);
  await tarjeta(page, A2, 'Solicitar segunda visita').getByRole('button', { name: 'Solicitar segunda visita' }).click();
  await confirmar(page, 'Aceptar');
  await expect(page.getByText('Segunda visita solicitada. Programación fue notificada.')).toBeVisible();
});

test('6. programación agenda la 2ª visita', async ({ page }) => {
  await programar(page, numeroCotizacion, EDIFICIO, { segunda: true });
});

test('7. en la 2ª visita el inspector marca el ascensor 1 corregido y el ascensor 2 sin corregir', async ({ page }) => {
  await ingresar(page, 'inspector@gmail.com');
  for (const [equipo, estado] of [[A1, 'Corregido'], [A2, 'No corregido']]) {
    await menu(page, 'Mi agenda');
    await (await botonDeEquipo(page, EDIFICIO, equipo, 'Iniciar 2ª visita')).click();
    await expect(page.getByText(/2ª visita/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
    await expect(page.getByText(/^Hallazgos: 1/)).toBeVisible();
    await page.getByRole('button', { name: estado, exact: true }).click();
    await recogerFirmas(page);
    await page.getByRole('button', { name: 'Finalizar segunda visita' }).click();
    await confirmar(page, 'Finalizar');
    await enviadoAlDirector(page);
  }
});

test('8. el director aprueba los informes de 2ª visita', async ({ page }) => {
  await abrirInforme(page, EDIFICIO, A1);
  await aprobarInforme(page, 'Todos los hallazgos se corrigieron: pasa a Certificados.');
  await abrirInforme(page, EDIFICIO, A2);
  await aprobarInforme(page, /Quedan hallazgos sin corregir: el equipo queda cerrado no conforme/);
});

test('9. certificados emite solo el del ascensor corregido', async ({ page }) => {
  await certificarYEnviar(page, EDIFICIO);
  await menu(page, 'Certificados por elaborar');
  await expect(page.getByText(new RegExp(EDIFICIO))).toHaveCount(0);
});

test('10. el cliente ve los dos informes y el certificado, y el aviso del equipo cerrado no conforme', async ({ page }) => {
  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Mis equipos');
  const fila1 = page.locator('div').filter({ hasText: numeroCotizacion }).filter({ hasText: A1 })
    .filter({ has: page.getByRole('button', { name: /^Certificado/ }) }).last();
  await expect(fila1.getByRole('button', { name: /Informe 1ª visita/ })).toBeVisible();
  await comprobarPdf(page, fila1.getByRole('button', { name: /Informe 2ª visita/ }));
  await comprobarPdf(page, fila1.getByRole('button', { name: /^Certificado/ }));
  const fila2 = page.locator('div').filter({ hasText: numeroCotizacion }).filter({ hasText: A2 });
  await expect(fila2.getByText('Hallazgos sin corregir en la 2ª visita: requiere cotización nueva').last()).toBeVisible();
});

test('11. el asesor crea la cotización nueva para el equipo cerrado no conforme', async ({ page }) => {
  await abrirCotizacion(page, 'asesor@gmail.com', numeroCotizacion);
  await page.getByRole('button', { name: 'Crear cotización nueva para este equipo' }).click();
  await page.getByRole('checkbox', { name: A2 }).click();
  await campo(page, 'Valor').fill('450000');
  await page.getByRole('button', { name: 'Crear cotización' }).click();
  await expect(page.getByText(/continúa un servicio cerrado no conforme/)).toBeVisible();
});

test('12. el QR verifica el certificado y, tras anularlo el administrador, muestra que ya no es válido', async ({ page, request }) => {
  const certificados = await (await request.get(`${API}/certificados`, { headers: await tokenApi(request, 'certificados@gmail.com') })).json();
  const cert = certificados.find((c) => c.edificio === EDIFICIO);
  const verificar = async () => (await (await request.get(`${API}/verificar/${cert.codigo_verificacion}`)).json()).estado;
  expect(await verificar()).toBe('VIGENTE');

  // Certificados no puede anular uno ya enviado: lo hace el administrador
  await ingresar(page, 'admin@gmail.com');
  await menu(page, 'Certificados emitidos');
  await tarjeta(page, EDIFICIO, 'Anular').getByRole('button', { name: 'Anular', exact: true }).click();
  await escribirYAceptar(page, 'Motivo', 'Prueba E2E de anulación');
  await expect(page.getByText('Certificado anulado')).toBeVisible();
  expect(await verificar()).toBe('ANULADO');
});
