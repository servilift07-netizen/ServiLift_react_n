// Pasos y ayudas comunes de las pruebas E2E: ingresar con cada rol y recorrer las pantallas del proceso.
// Los cuadros de diálogo de React Native Paper en la web no tienen rol "dialog" ni etiquetas asociadas a sus
// campos: se ubica el campo por el texto de su etiqueta y el botón por su nombre (el último es el del diálogo).
import { expect } from '@playwright/test';

export const CLAVE = '123456';
export const API = `http://localhost:${process.env.API_PORT ?? 8010}`;

// Variantes de un ascensor eléctrico con cuarto de máquinas (las mismas de servilift-backend/tests/test_flujo.py)
export const VARIANTES = [
  ['Tipo de accionamiento', 'Eléctrico'], ['Enhebrado', '1:1'], ['Tipo de máquina', 'Gearless (sin reductor)'],
  ['Tracción por', 'Cable'], ['Cuarto de máquinas', 'Con cuarto'], ['Tipo de buffer', 'Resorte o caucho'],
  ['Limitador de cabina', 'Sí'], ['Limitador de contrapeso', 'No'], ['Cuarto de poleas', 'No'],
  ['Puerta escotilla o de socorro', 'No'], ['Tipo de puerta de piso', 'Batiente'], ['Mirilla de puertas', 'No'],
];

// Foto JPEG de 64x48 px para el registro fotográfico
export const foto = (name = 'evidencia.jpg') => ({ name, mimeType: 'image/jpeg', buffer: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCxRRRXYcgUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//2Q==', 'base64') });

/** Nombre único por corrida, para no chocar con datos de corridas anteriores en la base de pruebas. */
export const unico = (prefijo) => `${prefijo} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Cada rol entra con la sesión limpia, como en un equipo distinto
export async function ingresar(page, correo, clave = CLAVE) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('/');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Inicio').first()).toBeVisible();
}

export async function menu(page, seccion, titulo = seccion) {
  await page.getByText(seccion, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
}

export function campo(page, etiqueta) {
  return page.getByText(etiqueta, { exact: true }).last()
    .locator('xpath=ancestor::div[.//input or .//textarea][1]').locator('input, textarea').first();
}

export async function elegir(page, etiqueta, opcion) {
  await page.getByRole('button', { name: new RegExp(`^${etiqueta}`) }).last().click();
  await page.getByRole('radio', { name: opcion, exact: true }).last().click();
}

export async function confirmar(page, boton) {
  await page.getByRole('button', { name: boton, exact: true }).last().click();
}

/** Escribe en el cuadro de texto de un diálogo (motivo, observaciones) y pulsa Aceptar. */
export async function escribirYAceptar(page, etiqueta, texto) {
  await campo(page, etiqueta).fill(texto);
  await confirmar(page, 'Aceptar');
}

// Tarjeta (la más interna) que contiene un texto y un botón
export function tarjeta(page, texto, boton) {
  return page.locator('div').filter({ hasText: texto })
    .filter({ has: page.getByRole('button', { name: boton, exact: true }) }).last();
}

/** Botón de la fila de un equipo dentro de la tarjeta de un edificio o una cotización (agenda, seguimiento). */
export async function botonDeEquipo(page, contexto, equipo, boton) {
  const b = page.getByRole('button', { name: boton, exact: true });
  // Lo más interno que tiene el contexto, el equipo y el botón: la fila (si la fila muestra el contexto) o la tarjeta
  const bloque = page.locator('div').filter({ hasText: contexto }).filter({ hasText: equipo }).filter({ has: b }).last();
  await bloque.waitFor();
  const fila = bloque.locator('div').filter({ hasText: equipo }).filter({ has: b }).last();
  return ((await fila.count()) ? fila : bloque).getByRole('button', { name: boton, exact: true });
}

/**
 * Pulsa el botón de ícono (lápiz, tres puntos) de la tarjeta que contiene el texto. Se pulsa con el mouse en su
 * posición después de desplazar la lista: un clic con desplazamiento automático no alcanza a abrir el menú, y
 * Playwright ve el lápiz de los usuarios como deshabilitado porque la fila (List.Item) no se puede pulsar.
 */
export async function pulsarIconoDeTarjeta(page, texto, abre) {
  const icono = page.getByTestId('card').filter({ hasText: texto }).getByTestId('icon-button').last();
  for (let intento = 0; intento < 4; intento++) {
    await icono.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const caja = await icono.boundingBox();
    await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
    // `abre`: lo que debe aparecer (menú o formulario); si la lista se redibujó y no apareció, se vuelve a pulsar
    if (!abre || await abre.waitFor({ timeout: 2_000 }).then(() => true, () => false)) return;
  }
  await expect(abre).toBeVisible();
}

/** Elige una opción del menú abierto con pulsarIconoDeTarjeta (con el mouse, por la misma razón). */
export async function elegirDelMenu(page, opcion) {
  const item = page.getByTestId('menu-item-title').filter({ hasText: new RegExp(`^${opcion}$`) }).last();
  await page.waitForTimeout(300);
  const caja = await item.boundingBox();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
}

export async function esperarSincronizado(page) {
  await expect(page.getByText('Todo sincronizado con el servidor')).toBeVisible({ timeout: 90_000 });
}

// Dibuja una firma en el lienzo del diálogo abierto y la guarda. Si el trazo no alcanzó a quedar
// ("Firme dentro del recuadro"), vuelve a dibujar.
export async function firmar(page) {
  const guardar = page.getByRole('button', { name: 'Guardar firma' });
  await expect(guardar).toBeVisible();
  for (let intento = 0; intento < 3 && await guardar.isVisible(); intento++) {
    const caja = await page.locator('svg[width="100%"][height="100%"]').last().boundingBox();
    await page.mouse.move(caja.x + 30, caja.y + 120);
    await page.mouse.down();
    for (const [x, y] of [[80, 60], [130, 150], [180, 70], [240, 130]]) await page.mouse.move(caja.x + x, caja.y + y, { steps: 5 });
    await page.mouse.up();
    await guardar.click();
    await expect(guardar).toBeHidden({ timeout: 3_000 }).catch(() => undefined);
  }
  await expect(guardar).toBeHidden();
}

/** Sube fotos con el botón indicado (el navegador abre el selector de archivos). */
// Si la pantalla se estaba redibujando (p. ej. al guardar una observación) el clic se pierde: se reintenta.
export async function subirFoto(page, abrir, nombre) {
  let selector = null;
  for (let intento = 0; intento < 3 && !selector; intento++) {
    const espera = page.waitForEvent('filechooser', { timeout: 5_000 }).catch(() => null);
    await abrir.click();
    selector = await espera;
  }
  expect(selector, 'no se abrió el selector de fotos').toBeTruthy();
  await selector.setFiles(foto(nombre));
  await expect(page.getByText('1 foto(s) subidas').last()).toBeVisible();
}

/** Token de la API para consultas de verificación (no reemplaza a las pantallas). */
export async function tokenApi(request, correo) {
  const r = await request.post(`${API}/auth/login`, { data: { correo, contrasena: CLAVE } });
  expect(r.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

// ───────────────────────── Pasos del proceso ─────────────────────────

/** Asesor: agrega un edificio al cliente de datos iniciales y deja que la app cree sus ascensores. */
export async function crearEdificio(page, edificio, ascensores = 1) {
  await ingresar(page, 'asesor@gmail.com');
  await menu(page, 'Clientes y edificios');
  await page.getByRole('button', { name: /NIT POR-DEFINIR/ }).click();
  await page.getByRole('button', { name: 'Agregar edificio' }).click();
  await campo(page, 'Nombre del edificio / torre *').fill(edificio);
  await campo(page, 'Dirección *').fill('Cra 7 # 10-20');
  await campo(page, 'Ciudad *').fill('Bogotá');
  await campo(page, 'Número de ascensores *').fill(String(ascensores));
  await confirmar(page, 'Guardar');
  // La app ofrece crear de una vez los ascensores declarados (Ascensor 1, 2, ...)
  await confirmar(page, 'Crear');
  await page.getByRole('button', { name: new RegExp(edificio) }).click();
  for (let i = 1; i <= ascensores; i++) await expect(page.getByText(`Ascensor ${i}`, { exact: true })).toBeVisible();
}

/** Asesor (ya en la pantalla del edificio): cotiza los ascensores indicados y la envía al cliente. Devuelve el número. */
export async function cotizarYEnviar(page, ascensores) {
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  for (const a of ascensores) {
    await page.getByRole('checkbox', { name: a }).click();
    await campo(page, 'Valor').fill('450000');
  }
  await page.getByRole('button', { name: 'Crear cotización' }).click();
  await expect(page.getByText(/^COT-/).first()).toBeVisible();
  const numero = (await page.getByText(/^COT-/).first().textContent()).trim();
  await expect(page.getByText('NTC 5926-1:2012', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Enviar al cliente' }).click();
  await confirmar(page, 'Confirmar');
  await expect(page.getByText('Cotización enviada al cliente')).toBeVisible();
  return numero;
}

export async function abrirCotizacion(page, correo, numero) {
  await ingresar(page, correo);
  await menu(page, 'Cotizaciones');
  await page.getByText(numero).first().click();
  await expect(page.getByRole('heading', { name: numero })).toBeVisible();
}

/** Cliente aprueba y asesor envía a programación. */
export async function aprobarYEnviarAProgramacion(page, numero) {
  await abrirCotizacion(page, 'cliente@gmail.com', numero);
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await confirmar(page, 'Aprobar');
  await expect(page.getByText('Cotización aprobada')).toBeVisible();
  await abrirCotizacion(page, 'asesor@gmail.com', numero);
  await page.getByRole('button', { name: 'Aceptar y enviar a programación' }).click();
  await confirmar(page, 'Confirmar');
  await expect(page.getByText('Enviada a programación')).toBeVisible();
}

/** Programación agenda la visita (primera o segunda) de todos los equipos de la tarjeta. */
export async function programar(page, numero, edificio, { segunda = false } = {}) {
  await ingresar(page, 'programacion@gmail.com');
  await menu(page, 'Por programar');
  const filtro = page.locator('div').filter({ hasText: `${numero} · ${edificio}` })
    .filter({ hasText: segunda ? 'Segunda visita (última)' : 'Primera visita' })
    .filter({ has: page.getByRole('button', { name: 'Programar', exact: true }) }).last();
  await filtro.getByRole('button', { name: 'Programar', exact: true }).click();
  await elegir(page, 'Inspector', 'Inspector');
  await page.getByRole('button', { name: 'Programar y notificar' }).click();
  await expect(page.getByText('Programado. Se notificó al inspector.')).toBeVisible();
}

/**
 * Inspector: abre el equipo desde la agenda y diligencia la 1ª visita. Los primeros `noCumple` ítems pendientes
 * quedan "No cumple" con observación y foto; el resto "Cumple". Con `sinSenal` califica una parte sin conexión.
 */
export async function inspeccionar(page, edificio, equipo, { noCumple = 0, sinSenal = false } = {}) {
  await menu(page, 'Mi agenda');
  await (await botonDeEquipo(page, edificio, equipo, 'Iniciar')).click();
  await expect(page.getByText(/1ª visita/).first()).toBeVisible();

  // Datos: variantes del equipo (con ellas el checklist marca solo los ítems que no aplican)
  await page.getByRole('button', { name: 'Editar' }).nth(1).click();
  for (const [variante, opcion] of VARIANTES) await elegir(page, variante, opcion);
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await esperarSincronizado(page);

  await page.getByRole('button', { name: 'Checklist', exact: true }).click();
  await expect(page.getByText(/NA 3\d/)).toBeVisible();
  await page.getByText('Pendientes', { exact: true }).click();
  // El primer botón "No cumple" es el filtro de arriba; los siguientes son los de cada ítem
  for (let i = 0; i < noCumple; i++) await page.getByRole('button', { name: 'No cumple', exact: true }).nth(1).click();
  const cumple = page.getByRole('button', { name: 'Cumple', exact: true });
  if (sinSenal) {
    // Sin señal: lo calificado queda en el teléfono y se envía solo al volver la conexión
    await page.context().setOffline(true);
    for (let i = 0; i < 10; i++) await cumple.first().click();
    await expect(page.getByText(/cambio\(s\) guardados en el teléfono/)).toBeVisible();
    await page.context().setOffline(false);
  }
  while (await cumple.count()) await cumple.first().click();
  await expect(page.getByText(/^169\/169 calificados/)).toBeVisible();
  await page.getByText('Con medición', { exact: true }).click();
  const medidas = page.locator('input');
  for (let i = 0; i < await medidas.count(); i++) {
    await medidas.nth(i).fill('12');
    await medidas.nth(i).press('Tab');
  }
  if (noCumple) {
    // Cada hallazgo lleva observación y foto de evidencia (van al informe)
    await page.getByText('No cumple', { exact: true }).first().click();
    // Con este filtro los únicos cuadros de texto largos son las observaciones de los hallazgos
    for (let i = 0; i < noCumple; i++) {
      const caja = page.locator('textarea').nth(i);
      await caja.fill(`Hallazgo E2E ${i + 1}`);
      await caja.press('Tab');
      await subirFoto(page, page.getByRole('button', { name: 'Foto (0)' }).first(), `hallazgo-${i + 1}.jpg`);
    }
  }
  await esperarSincronizado(page);

  await page.getByRole('button', { name: 'Fotos', exact: true }).click();
  await subirFoto(page, page.getByText('Agregar fotos'), 'cuarto-maquinas.jpg');
  await recogerFirmas(page);
  await page.getByRole('button', { name: 'Finalizar inspección' }).click();
  await confirmar(page, 'Finalizar');
  await enviadoAlDirector(page);
}

/** Tras finalizar, la app avisa "Enviado al director técnico" (3 s) y vuelve a la agenda. */
export async function enviadoAlDirector(page) {
  await expect(page.getByText('Enviado al director técnico').or(page.getByRole('heading', { name: 'Mi agenda' })).first())
    .toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mi agenda' })).toBeVisible();
}

/** Firmas del inspector, del técnico de mantenimiento y del representante del edificio para la visita actual. */
export async function recogerFirmas(page) {
  await page.getByRole('button', { name: 'Firmas', exact: true }).click();
  const pendiente = page.getByRole('button', { name: 'Firmar', exact: true });
  await expect(pendiente).toHaveCount(3);
  for (const nombre of ['Inspector', 'Técnico E2E', 'Representante E2E']) {
    const antes = await pendiente.count();
    await pendiente.first().click();
    const campoNombre = campo(page, 'Nombre completo *');
    if (!(await campoNombre.inputValue())) await campoNombre.fill(nombre);
    await confirmar(page, 'Continuar a la firma');
    await firmar(page);
    await expect(pendiente).toHaveCount(antes - 1);
  }
  await esperarSincronizado(page);
}

/** Director técnico: abre el informe del equipo en "Informes por revisar". */
export async function abrirInforme(page, edificio, equipo) {
  await ingresar(page, 'director@gmail.com');
  await menu(page, 'Informes por revisar');
  await page.locator('div').filter({ hasText: edificio }).filter({ hasText: equipo }).last().click();
  await expect(page.getByRole('button', { name: 'Aprobar, firmar y generar PDF' })).toBeVisible();
}

/** Director técnico (con el informe abierto): aprueba y firma. `aviso` es el texto que explica qué sigue. */
export async function aprobarInforme(page, aviso) {
  await page.getByRole('button', { name: 'Aprobar, firmar y generar PDF' }).click();
  if (aviso) await expect(page.getByText(aviso)).toBeVisible();
  await confirmar(page, 'Firmar');
  await firmar(page);
  await expect(page.getByText('Informe aprobado. Ya está disponible para el cliente.')).toBeVisible({ timeout: 60_000 });
}

/** Certificados: elabora el certificado del equipo y lo envía al cliente. */
export async function certificarYEnviar(page, edificio) {
  await ingresar(page, 'certificados@gmail.com');
  await menu(page, 'Certificados por elaborar');
  await tarjeta(page, edificio, 'Elaborar certificado').getByRole('button', { name: 'Elaborar certificado' }).click();
  await confirmar(page, 'Emitir');
  await expect(page.getByText('Certificado emitido')).toBeVisible({ timeout: 60_000 });
  await menu(page, 'Certificados emitidos');
  await tarjeta(page, edificio, 'Enviar').getByRole('button', { name: 'Enviar', exact: true }).click();
  await confirmar(page, 'Enviar');
  await expect(tarjeta(page, edificio, 'PDF').getByRole('button', { name: 'Enviar', exact: true })).toHaveCount(0);
}

/** Abre el PDF de un botón (se abre en otra pestaña con enlace firmado) y comprueba que sea un PDF. */
export async function comprobarPdf(page, boton) {
  const pestana = page.waitForEvent('popup');
  await boton.click();
  const descarga = await page.request.get((await pestana).url());
  expect(descarga.ok()).toBeTruthy();
  expect((await descarga.body()).subarray(0, 4).toString()).toBe('%PDF');
}
