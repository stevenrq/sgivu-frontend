import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

const MOBILE_VIEWPORT = { width: 360, height: 740 };

/**
 * Verifica que las páginas clave no producen overflow horizontal en un viewport
 * de 360 px (Android estándar). Criterio del plan (U3): ninguna página
 * muestra scroll horizontal en < 480 px.
 */
test.describe('Responsividad móvil (360 px)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  async function hasNoHorizontalOverflow(
    page: import('@playwright/test').Page,
  ): Promise<boolean> {
    return page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
  }

  test('Dashboard no desborda horizontalmente', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('Vehículos en Inventario').waitFor();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Listado de usuarios no desborda horizontalmente', async ({ page }) => {
    await page.goto('/users');
    await page.getByText('Ana Admin').waitFor();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Listado de compraventas no desborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/purchase-sales');
    await page.getByText('Gestión de compras y ventas').waitFor();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Formulario de registro de compraventa no desborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/purchase-sales/register');
    await page.getByText('Registrar contrato de compraventa').waitFor();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
