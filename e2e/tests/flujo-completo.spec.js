import { expect, test } from '@playwright/test';

// Recorrido completo de la certificación de un ascensor, pantalla por pantalla y con el rol que hace cada paso:
// asesor (edificio, ascensor y cotización) -> cliente (aprueba) -> asesor (envía a programación) -> programación
// (agenda la visita) -> inspector (datos, variantes, checklist, foto y firmas) -> director técnico (aprueba y
// firma) -> certificados (elabora y envía) -> cliente (ve el informe y el certificado en Mis equipos).
// Usa el cliente de datos iniciales (database/03_datos_iniciales.sql) y crea un edificio nuevo en cada corrida.

const CLAVE = '123456';
const SUF = Date.now().toString(36);
const EDIFICIO = `Torre E2E ${SUF}`;
const ASCENSOR = 'Ascensor 1';

// Variantes de un ascensor eléctrico con cuarto de máquinas (las mismas de servilift-backend/tests/test_flujo.py)
const VARIANTES = [
  ['Tipo de accionamiento', 'Eléctrico'], ['Enhebrado', '1:1'], ['Tipo de máquina', 'Gearless (sin reductor)'],
  ['Tracción por', 'Cable'], ['Cuarto de máquinas', 'Con cuarto'], ['Tipo de buffer', 'Resorte o caucho'],
  ['Limitador de cabina', 'Sí'], ['Limitador de contrapeso', 'No'], ['Cuarto de poleas', 'No'],
  ['Puerta escotilla o de socorro', 'No'], ['Tipo de puerta de piso', 'Batiente'], ['Mirilla de puertas', 'No'],
];
// Foto JPEG de 64x48 px para el registro fotográfico
const FOTO = { name: 'cuarto-maquinas.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCxRRRXYcgUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//2Q==', 'base64') };

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);
test.use({ actionTimeout: 20_000 });

let numeroCotizacion = '';

// Cada rol entra con la sesión limpia, como en un equipo distinto
async function ingresar(page, correo) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('/');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Inicio').first()).toBeVisible();
}

async function menu(page, seccion) {
  await page.getByText(seccion, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: seccion })).toBeVisible();
}

// Los cuadros de diálogo de React Native Paper en la web no tienen rol "dialog" ni etiquetas asociadas a sus
// campos: se ubica el campo por el texto de su etiqueta y el botón por su nombre (el último es el del diálogo).
function campo(page, etiqueta) {
  return page.getByText(etiqueta, { exact: true }).last()
    .locator('xpath=ancestor::div[.//input or .//textarea][1]').locator('input, textarea').first();
}

async function elegir(page, etiqueta, opcion) {
  await page.getByRole('button', { name: new RegExp(`^${etiqueta}`) }).last().click();
  await page.getByRole('radio', { name: opcion, exact: true }).last().click();
}

async function confirmar(page, boton) {
  await page.getByRole('button', { name: boton, exact: true }).last().click();
}

// Tarjeta (la más interna) que contiene un texto y un botón
function tarjeta(page, texto, boton) {
  return page.locator('div').filter({ hasText: texto })
    .filter({ has: page.getByRole('button', { name: boton, exact: true }) }).last();
}

async function esperarSincronizado(page) {
  await expect(page.getByText('Todo sincronizado con el servidor')).toBeVisible({ timeout: 60_000 });
}

// Dibuja una firma en el lienzo del diálogo abierto y la guarda
async function firmar(page) {
  const lienzo = page.locator('svg[width="100%"][height="100%"]').last();
  const caja = await lienzo.boundingBox();
  await page.mouse.move(caja.x + 30, caja.y + 120);
  await page.mouse.down();
  for (const [x, y] of [[80, 60], [130, 150], [180, 70], [240, 130]]) await page.mouse.move(caja.x + x, caja.y + y, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Guardar firma' }).click();
}

test('1. el asesor registra el edificio y el ascensor y envía la cotización al cliente', async ({ page }) => {
  await ingresar(page, 'asesor@gmail.com');
  await menu(page, 'Clientes y edificios');
  await page.getByRole('button', { name: /NIT POR-DEFINIR/ }).click();

  await page.getByRole('button', { name: 'Agregar edificio' }).click();
  await campo(page, 'Nombre del edificio / torre *').fill(EDIFICIO);
  await campo(page, 'Dirección *').fill('Cra 7 # 10-20');
  await campo(page, 'Ciudad *').fill('Bogotá');
  await campo(page, 'Número de ascensores *').fill('1');
  await confirmar(page, 'Guardar');
  // La app ofrece crear de una vez los ascensores declarados (Ascensor 1, 2, ...)
  await confirmar(page, 'Crear');

  await page.getByRole('button', { name: new RegExp(EDIFICIO) }).click();
  await expect(page.getByText(ASCENSOR, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  await page.getByRole('checkbox', { name: ASCENSOR }).click();
  await campo(page, 'Valor').fill('450000');
  await page.getByRole('button', { name: 'Crear cotización' }).click();
  await expect(page.getByText(/^COT-/).first()).toBeVisible();
  numeroCotizacion = (await page.getByText(/^COT-/).first().textContent()).trim();
  await expect(page.getByText('NTC 5926-1:2012', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Enviar al cliente' }).click();
  await confirmar(page, 'Confirmar');
  await expect(page.getByText('Cotización enviada al cliente')).toBeVisible();
});

test('2. el cliente aprueba la cotización y el asesor la envía a programación', async ({ page }) => {
  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Cotizaciones');
  await page.getByText(numeroCotizacion).first().click();
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await confirmar(page, 'Aprobar');
  await expect(page.getByText('Cotización aprobada')).toBeVisible();

  await ingresar(page, 'asesor@gmail.com');
  await menu(page, 'Cotizaciones');
  await page.getByText(numeroCotizacion).first().click();
  await page.getByRole('button', { name: 'Aceptar y enviar a programación' }).click();
  await confirmar(page, 'Confirmar');
  await expect(page.getByText('Enviada a programación')).toBeVisible();
});

test('3. programación agenda la visita y notifica al inspector', async ({ page }) => {
  await ingresar(page, 'programacion@gmail.com');
  await menu(page, 'Por programar');
  await tarjeta(page, `${numeroCotizacion} · ${EDIFICIO}`, 'Programar').getByRole('button', { name: 'Programar' }).click();
  await elegir(page, 'Inspector', 'Inspector');
  await page.getByRole('button', { name: 'Programar y notificar' }).click();
  await expect(page.getByText('Programado. Se notificó al inspector.')).toBeVisible();
});

test('4. el inspector diligencia la inspección y la envía al director técnico', async ({ page }) => {
  await ingresar(page, 'inspector@gmail.com');
  await menu(page, 'Mi agenda');
  await tarjeta(page, EDIFICIO, 'Iniciar').getByRole('button', { name: 'Iniciar' }).click();
  await expect(page.getByText(/1ª visita/).first()).toBeVisible();

  // Datos: variantes del equipo (con ellas el checklist marca solo los ítems que no aplican)
  await page.getByRole('button', { name: 'Editar' }).nth(1).click();
  for (const [variante, opcion] of VARIANTES) await elegir(page, variante, opcion);
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await esperarSincronizado(page);

  // Checklist: todo "Cumple" (1ª visita conforme) y las medidas obligatorias
  await page.getByRole('button', { name: 'Checklist', exact: true }).click();
  await expect(page.getByText(/NA 3\d/)).toBeVisible();
  await page.getByText('Pendientes', { exact: true }).click();
  const cumple = page.getByRole('button', { name: 'Cumple', exact: true });
  while (await cumple.count()) await cumple.first().click();
  await expect(page.getByText(/^169\/169 calificados/)).toBeVisible();
  await page.getByText('Con medición', { exact: true }).click();
  const medidas = page.locator('input');
  for (let i = 0; i < await medidas.count(); i++) {
    await medidas.nth(i).fill('12');
    await medidas.nth(i).press('Tab');
  }
  await esperarSincronizado(page);

  // Fotos: registro fotográfico general
  await page.getByRole('button', { name: 'Fotos', exact: true }).click();
  const selector = page.waitForEvent('filechooser');
  await page.getByText('Agregar fotos').click();
  await (await selector).setFiles(FOTO);
  await expect(page.getByText('1 foto(s) subidas')).toBeVisible();

  // Firmas: inspector, técnico de mantenimiento y representante del edificio
  await page.getByRole('button', { name: 'Firmas', exact: true }).click();
  for (const nombre of ['Inspector', 'Técnico E2E', 'Representante E2E']) {
    await page.getByRole('button', { name: 'Firmar', exact: true }).first().click();
    const campoNombre = campo(page, 'Nombre completo *');
    if (!(await campoNombre.inputValue())) await campoNombre.fill(nombre);
    await confirmar(page, 'Continuar a la firma');
    await firmar(page);
  }
  await expect(page.getByRole('button', { name: 'Firmar', exact: true })).toHaveCount(0);
  await esperarSincronizado(page);

  await page.getByRole('button', { name: 'Finalizar inspección' }).click();
  await confirmar(page, 'Finalizar');
  await expect(page.getByText('Enviado al director técnico')).toBeVisible();
});

test('5. el director técnico aprueba y firma el informe conforme', async ({ page }) => {
  await ingresar(page, 'director@gmail.com');
  await menu(page, 'Informes por revisar');
  await page.getByText(new RegExp(EDIFICIO)).first().click();
  await page.getByRole('button', { name: 'Aprobar, firmar y generar PDF' }).click();
  await expect(page.getByText('Pasa a Certificados para emitir el certificado.')).toBeVisible();
  await confirmar(page, 'Firmar');
  await firmar(page);
  await expect(page.getByText('Informe aprobado. Ya está disponible para el cliente.')).toBeVisible({ timeout: 60_000 });
});

test('6. certificados elabora el certificado y lo envía al cliente', async ({ page }) => {
  await ingresar(page, 'certificados@gmail.com');
  await menu(page, 'Certificados por elaborar');
  await tarjeta(page, EDIFICIO, 'Elaborar certificado').getByRole('button', { name: 'Elaborar certificado' }).click();
  await confirmar(page, 'Emitir');
  await expect(page.getByText('Certificado emitido')).toBeVisible({ timeout: 60_000 });
  await menu(page, 'Certificados emitidos');
  await tarjeta(page, EDIFICIO, 'Enviar').getByRole('button', { name: 'Enviar', exact: true }).click();
  await confirmar(page, 'Enviar');
  await expect(tarjeta(page, EDIFICIO, 'PDF').getByRole('button', { name: 'Enviar', exact: true })).toHaveCount(0);
});

test('7. el cliente ve el informe y el certificado de su ascensor', async ({ page }) => {
  await ingresar(page, 'cliente@gmail.com');
  await menu(page, 'Mis equipos');
  const fila = page.locator('div').filter({ hasText: numeroCotizacion }).filter({ hasText: ASCENSOR })
    .filter({ has: page.getByRole('button', { name: /^Certificado/ }) }).last();
  await expect(fila.getByRole('button', { name: /Informe 1ª visita/ })).toBeVisible();
  // El certificado se abre en otra pestaña con un enlace de descarga firmado: debe ser un PDF
  const pestana = page.waitForEvent('popup');
  await fila.getByRole('button', { name: /^Certificado/ }).click();
  const descarga = await page.request.get((await pestana).url());
  expect(descarga.ok()).toBeTruthy();
  expect((await descarga.body()).subarray(0, 4).toString()).toBe('%PDF');
});
