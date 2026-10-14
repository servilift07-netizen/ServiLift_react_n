import { expect, test } from '@playwright/test';
import { campo, confirmar, elegir, ingresar, menu, pulsarIconoDeTarjeta } from './utilidades/ui.js';

// Configuración del sistema por el administrador: usuarios (crear, cambiar contraseña, inactivar), normas y parámetros.

test.setTimeout(120_000);
test.use({ actionTimeout: 20_000 });

test('el administrador crea un inspector que entra, cambia su contraseña y deja de entrar al quedar inactivo', async ({ page }) => {
  const sufijo = Date.now().toString(36);
  const correo = `inspector_${sufijo}@servilift-prueba.co`;
  const nombre = `Inspector E2E ${sufijo}`;

  await ingresar(page, 'admin@gmail.com');
  await menu(page, 'Usuarios');
  await page.getByText('Nuevo usuario').click();
  await elegir(page, 'Rol', 'Inspector');
  await campo(page, 'Nombre completo *').fill(nombre);
  await campo(page, 'Correo *').fill(correo);
  await campo(page, 'Contraseña (mín. 6) *').fill('clave1');
  await confirmar(page, 'Guardar');
  await expect(page.getByText(nombre)).toBeVisible();

  // El usuario nuevo entra con su rol y cambia la contraseña
  await ingresar(page, correo, 'clave1');
  await expect(page.getByText('Mi agenda').first()).toBeVisible();
  await page.getByText('Cambiar contraseña', { exact: true }).click();
  await campo(page, 'Contraseña actual *').fill('clave1');
  await campo(page, 'Nueva contraseña (mín. 6) *').fill('clave2');
  await confirmar(page, 'Guardar');
  await expect(page.getByText('Contraseña actualizada')).toBeVisible();
  await ingresar(page, correo, 'clave2');

  // Inactivo: ya no puede ingresar
  await ingresar(page, 'admin@gmail.com');
  await menu(page, 'Usuarios');
  await pulsarIconoDeTarjeta(page, correo, page.getByText(`Editar ${correo}`));
  await elegir(page, 'Estado', 'Inactivo');
  await confirmar(page, 'Guardar');
  await expect(page.getByText('Inactivo').first()).toBeVisible();

  await page.goto('/');
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave2');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toContainText('Usuario inactivo');
});

test('el administrador ve la norma vigente con su checklist y los parámetros del sistema', async ({ page }) => {
  await ingresar(page, 'admin@gmail.com');
  await menu(page, 'Normas y checklist');
  await expect(page.getByText('NTC 5926-1:2012').first()).toBeVisible();
  await expect(page.getByText('169 ítems').first()).toBeVisible();
  await expect(page.getByText('Leve 180 · Grave 30 · Muy grave 0').first()).toBeVisible();

  // Los parámetros se abren para editarlos; se cancela para no cambiar los datos que usan las demás pruebas
  await menu(page, 'Parámetros');
  await expect(page.getByText('Nombre de la empresa (informes y certificados)')).toBeVisible();
  await page.getByText('Vigencia del certificado (meses)').click();
  await expect(campo(page, 'Valor *')).not.toHaveValue('');
  await confirmar(page, 'Cancelar');
});
