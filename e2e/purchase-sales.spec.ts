import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

test.describe('Compras y ventas', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe renderizar el listado sin datos sin romperse', async ({
    page,
  }) => {
    await page.goto('/purchase-sales');

    // La página carga con el guard de permisos satisfecho y endpoints vacíos
    await expect(page.getByText('Gestión de compras y ventas')).toBeVisible();
    await expect(page).toHaveURL(/\/purchase-sales/);
  });
});
