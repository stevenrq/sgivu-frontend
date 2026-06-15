import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

/**
 * Escaneo de accesibilidad con axe-core sobre las páginas clave.
 * Criterio del plan (docs/PLAN_MEJORAS.md): cero violaciones serias o críticas.
 */
async function expectNoSeriousViolations(
  page: import('@playwright/test').Page,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    serious.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')),
    })),
  ).toEqual([]);
}

test.describe('Accesibilidad (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe pasar el escaneo axe en el listado de usuarios', async ({
    page,
  }) => {
    await page.goto('/users');
    await page.getByText('Ana Admin').waitFor();

    await expectNoSeriousViolations(page);
  });

  test('Debe pasar el escaneo axe en el editor de permisos', async ({
    page,
  }) => {
    await page.goto('/roles-permissions/2/permissions');
    await page.locator('[id="perm-user:read"]').waitFor();

    await expectNoSeriousViolations(page);
  });
});
