import { expect, test } from '@playwright/test';

test.describe('Búsqueda de clientes del asesor', () => {
  test.beforeEach(async ({ page }) => {
    // Arrange común: el asesor ingresa y abre Clientes y edificios
    await page.goto('/');
    await page.getByLabel('Correo').fill('asesor@gmail.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.getByText('Clientes y edificios').click();
    await expect(page.getByRole('heading', { name: 'Clientes y edificios' })).toBeVisible();
  });

  test('should list the client that matches the search', async ({ page }) => {
    // Act
    await page.getByLabel('Buscar clientes').fill('POR-DEFINIR');
    await page.getByLabel('Buscar clientes').press('Enter');

    // Assert: aparece la tarjeta del cliente de datos iniciales (database/03_datos_iniciales.sql)
    await expect(page.getByRole('button', { name: /NIT POR-DEFINIR/ })).toBeVisible();
  });

  test('should show an empty message when no client matches the search', async ({ page }) => {
    // Act: texto único que ningún cliente puede tener
    await page.getByLabel('Buscar clientes').fill(`no-existe-${Date.now()}`);
    await page.getByLabel('Buscar clientes').press('Enter');

    // Assert
    await expect(page.getByText('Sin resultados para la búsqueda')).toBeVisible();
  });
});
