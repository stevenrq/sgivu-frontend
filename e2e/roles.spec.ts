import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api-mocks';

test.describe('Roles y permisos', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('Debe listar los roles del sistema', async ({ page }) => {
    await page.goto('/roles-permissions');

    await expect(page.getByText('Roles y Permisos')).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'ADMIN' }),
    ).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'USER' }),
    ).toBeVisible();
  });

  test('Debe precargar los permisos del rol en los checkboxes (regresión OnPush)', async ({
    page,
  }) => {
    // Acceso directo por URL: fuerza la carga de roles y catálogo desde el backend
    await page.goto('/roles-permissions/2/permissions');

    await expect(page.getByText('Editar permisos · USER')).toBeVisible();

    // El rol USER solo tiene user:read: su checkbox debe llegar marcado y el resto no
    await expect(page.locator('[id="perm-user:read"]')).toBeChecked();
    await expect(page.locator('[id="perm-user:create"]')).not.toBeChecked();
    await expect(page.locator('[id="perm-role:read"]')).not.toBeChecked();
  });

  test('Debe guardar la nueva selección de permisos del rol', async ({
    page,
  }) => {
    await page.goto('/roles-permissions/2/permissions');
    await expect(page.locator('[id="perm-user:read"]')).toBeChecked();

    await page.locator('[id="perm-user:create"]').check();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // Diálogo de confirmación de SweetAlert2
    const putRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        request.url().includes('/v1/roles/2/permissions'),
    );
    await page.getByRole('button', { name: 'Sí, guardar' }).click();

    const payload = (await putRequest).postDataJSON() as string[];
    expect(payload).toContain('user:read');
    expect(payload).toContain('user:create');

    // Feedback de éxito y regreso al listado
    await expect(
      page.getByText('Permisos actualizados correctamente.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/roles-permissions$/);
  });
});
