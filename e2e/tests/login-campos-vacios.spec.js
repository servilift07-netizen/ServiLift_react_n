import { expect, test } from '@playwright/test';

test('should ask for email and password when the form is submitted empty', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act: la persona pulsa Ingresar sin escribir nada
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // Assert: validación visible del formulario, sin llamar al backend
  await expect(page.getByRole('alert')).toHaveText('Ingrese correo y contraseña');
});
