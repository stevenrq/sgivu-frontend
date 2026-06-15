import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe renderizar KPIs y el panel de predicción de demanda', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // KPIs alimentados por el dashboard-summary simulado
    await expect(page.getByText('Vehículos en Inventario')).toBeVisible();
    await expect(page.getByText('Ventas del Mes')).toBeVisible();

    // Panel de predicción: sin modelo entrenado (mock 404 en /v1/ml/models/latest)
    await expect(
      page.getByRole('button', { name: 'Reentrenar' }),
    ).toBeVisible();
    await expect(page.getByText('Modelo no entrenado')).toBeVisible();
    await expect(page.getByLabel('Búsqueda rápida de vehículos')).toBeVisible();
  });
});
