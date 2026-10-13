import { expect, test } from '@playwright/test';

test('should return to the login page after confirming the logout', async ({ page }) => {
  // Arrange: sesión iniciada como programación
  await page.goto('/');
  await page.getByLabel('Correo').fill('programacion@gmail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();

  // Act: abre el menú, cierra sesión y confirma en el diálogo
  await page.getByText('Cerrar sesión').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  // Assert: vuelve el formulario de ingreso
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  await expect(page.getByLabel('Correo')).toBeVisible();
});
