import { expect, test } from '@playwright/test';

test('should show an error and stay on the login page when the password is wrong', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByLabel('Correo').fill('asesor@gmail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // Assert: el backend responde 401 y la app muestra el mensaje sin dejar entrar
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});
