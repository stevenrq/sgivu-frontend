import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

test.describe('Usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe mostrar el listado de usuarios con la sesión BFF simulada', async ({
    page,
  }) => {
    await page.goto('/users');

    await expect(
      page.getByRole('heading', { name: 'Usuarios registrados', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Ana Admin')).toBeVisible();
    await expect(page.getByText('Bruno Vendedor')).toBeVisible();
  });

  test('Debe navegar al formulario de creación desde el botón Crear Usuario', async ({
    page,
  }) => {
    await page.goto('/users');

    await page.getByRole('button', { name: 'Crear Usuario' }).click();

    await expect(page).toHaveURL(/\/users\/create$/);
    await expect(page.getByText(/cédula/i).first()).toBeVisible();
  });

  test('Debe abrir el panel de filtros avanzados desde el toolbar', async ({
    page,
  }) => {
    await page.goto('/users');

    await page.getByRole('button', { name: /Más filtros/ }).click();

    await expect(page.getByLabel('Nombre de usuario')).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  });
});
