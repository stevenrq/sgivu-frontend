import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

test.describe('Registro de compra/venta', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe alternar las secciones de compra y venta según el tipo de contrato', async ({
    page,
  }) => {
    await page.goto('/purchase-sales/register');

    await expect(
      page.getByText('Registrar contrato de compraventa'),
    ).toBeVisible();

    // Tipo "compra" (por defecto): precio de compra visible, selector de vehículo oculto.
    // Estos bloques se renderizan con @if(isPurchaseType)/@if(isSaleType); es la
    // reactividad que la migración zoneless debe preservar.
    await expect(page.locator('#contractPurchasePrice')).toBeVisible();
    await expect(page.locator('#contractVehicleId')).toHaveCount(0);

    // Cambiar a "venta": aparece el selector de vehículo, desaparece el precio de compra.
    await page
      .locator('label.contract-type-card[for="contractTypeSale"]')
      .click();
    await expect(page.locator('#contractVehicleId')).toBeVisible();
    await expect(page.locator('#contractPurchasePrice')).toHaveCount(0);

    // Volver a "compra".
    await page
      .locator('label.contract-type-card[for="contractTypePurchase"]')
      .click();
    await expect(page.locator('#contractPurchasePrice')).toBeVisible();
    await expect(page.locator('#contractVehicleId')).toHaveCount(0);
  });
});
