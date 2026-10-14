import { expect, test } from '@playwright/test';

// Flujo crítico: si nadie puede ingresar, ningún rol puede trabajar (ni el inspector en campo).
test('should show the advisor home page after logging in with valid credentials', async ({ page }) => {
  // Arrange: usuario de prueba de la base servilift_v2_prueba (database/02_seed.sql)
  await page.goto('/');

  // Act
  await page.getByLabel('Correo').fill('asesor@gmail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // Assert: la persona ve su página de inicio con su nombre
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();
  await expect(page.getByText('Hola, Asesor')).toBeVisible();
});
