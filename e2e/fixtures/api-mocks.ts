import { Page, Route } from '@playwright/test';

/** URLs de environment.development.ts (y de las plantillas .example usadas en CI). */
export const API_URL = 'http://localhost:8080';
export const AUTH_HEALTH_URL = 'http://sgivu-auth.127.0.0.1.nip.io:9000';
const APP_ORIGIN = 'http://localhost:4200';

// ── Datos semilla ────────────────────────────────────────────────────────────

export const PERMISSIONS = [
  { id: 1, name: 'user:read', description: 'Ver usuarios' },
  { id: 2, name: 'user:create', description: 'Crear usuarios' },
  { id: 3, name: 'user:update', description: 'Editar usuarios' },
  { id: 4, name: 'user:delete', description: 'Eliminar usuarios' },
  { id: 5, name: 'role:read', description: 'Ver roles' },
  { id: 6, name: 'role:update', description: 'Editar roles' },
  { id: 7, name: 'purchase_sale:read', description: 'Ver compraventas' },
  { id: 8, name: 'purchase_sale:create', description: 'Crear compraventas' },
];

export const ADMIN_ROLE = { id: 1, name: 'ADMIN', permissions: PERMISSIONS };
export const USER_ROLE = {
  id: 2,
  name: 'USER',
  permissions: PERMISSIONS.filter((p) => p.name === 'user:read'),
};
export const ROLES = [ADMIN_ROLE, USER_ROLE];

const ADDRESS = {
  id: 1,
  street: 'Calle 10 # 5-23',
  city: 'Bogotá',
  state: 'Cundinamarca',
};

export const ADMIN_USER = {
  id: 1,
  nationalId: 1012345678,
  firstName: 'Ana',
  lastName: 'Admin',
  address: ADDRESS,
  phoneNumber: 3001234567,
  email: 'ana.admin@sgivu.com',
  username: 'ana.admin',
  enabled: true,
  admin: true,
  roles: [ADMIN_ROLE],
};

export const PLAIN_USER = {
  id: 2,
  nationalId: 1098765432,
  firstName: 'Bruno',
  lastName: 'Vendedor',
  address: ADDRESS,
  phoneNumber: 3017654321,
  email: 'bruno.vendedor@sgivu.com',
  username: 'bruno.vendedor',
  enabled: true,
  admin: false,
  roles: [USER_ROLE],
};

export const USERS = [ADMIN_USER, PLAIN_USER];

/** Sesión BFF autenticada que hidrata AuthService en el arranque. */
export const SESSION = {
  authenticated: true,
  userId: '1',
  username: 'ana.admin',
  rolesAndPermissions: ['ROLE_ADMIN', ...PERMISSIONS.map((p) => p.name)],
  isAdmin: true,
};

/** Snapshot agregado del dashboard (contrato DashboardSummaryResponse del backend). */
export const DASHBOARD_SUMMARY = {
  generatedAt: '2026-06-11T10:00:00Z',
  contractStatusCounts: { ACTIVE: 1, COMPLETED: 1 },
  paymentMethodCounts: { CASH: 2 },
  monthlySales: [{ month: '2026-06', count: 1, totalAmount: 35000000 }],
  monthlyPurchases: [{ month: '2026-05', count: 1, totalAmount: 28000000 }],
  recentActivity: [],
  vehicleCounts: {
    totalCars: 4,
    availableCars: 3,
    totalMotorcycles: 2,
    availableMotorcycles: 1,
  },
  globalMetrics: {
    totalContracts: 2,
    totalPurchases: 1,
    totalSales: 1,
    totalRevenue: 35000000,
  },
};

/** Construye una página con el contrato `Page<T>` de Spring Data. */
export function springPage<T>(content: T[], pageNumber = 0) {
  const sort = { empty: true, sorted: false, unsorted: true };
  return {
    content,
    pageable: {
      pageNumber,
      pageSize: 6,
      sort,
      offset: pageNumber * 6,
      paged: true,
      unpaged: false,
    },
    last: true,
    totalPages: content.length > 0 ? 1 : 0,
    totalElements: content.length,
    size: 6,
    number: pageNumber,
    sort,
    first: pageNumber === 0,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

// ── Infraestructura CORS ─────────────────────────────────────────────────────
// Las respuestas fulfilled siguen pasando por las verificaciones CORS del
// navegador: como la app llama al gateway con `withCredentials: true`, hay que
// devolver el origin exacto y allow-credentials, y responder los preflight.

const CORS_HEADERS = {
  'access-control-allow-origin': APP_ORIGIN,
  'access-control-allow-credentials': 'true',
};

function preflight(route: Route): Promise<void> {
  const requestedHeaders =
    route.request().headers()['access-control-request-headers'] ?? '*';
  return route.fulfill({
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': requestedHeaders,
    },
  });
}

/** Responde JSON con cabeceras CORS; resuelve los preflight automáticamente. */
export function fulfillJson(
  route: Route,
  data: unknown,
  status = 200,
): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    return preflight(route);
  }
  return route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

// ── Mock principal ───────────────────────────────────────────────────────────

/**
 * Simula todo el gateway BFF para la smoke suite.
 *
 * Orden de registro: del catch-all a lo específico (Playwright evalúa las
 * rutas registradas más tarde primero). El catch-all mantiene los health
 * checks en UP y devuelve colecciones/páginas vacías para endpoints sin
 * fixture, de modo que ninguna pantalla reviente por un 404 inesperado.
 */
export async function mockApi(page: Page): Promise<void> {
  await page.route(`${AUTH_HEALTH_URL}/**`, (route) =>
    fulfillJson(route, { status: 'UP' }),
  );

  await page.route(`${API_URL}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/actuator/health')) {
      return fulfillJson(route, { status: 'UP' });
    }
    if (url.includes('/page/')) {
      return fulfillJson(route, springPage([]));
    }
    if (url.includes('/count')) {
      return fulfillJson(route, {});
    }
    return fulfillJson(route, []);
  });

  await page.route(`${API_URL}/auth/session`, (route) =>
    fulfillJson(route, SESSION),
  );
  await page.route(`${API_URL}/v1/purchase-sales/dashboard-summary`, (route) =>
    fulfillJson(route, DASHBOARD_SUMMARY),
  );
  // Sin modelo ML entrenado: el dashboard debe mostrar el aviso "Modelo no entrenado"
  await page.route(`${API_URL}/v1/ml/models/latest`, (route) =>
    fulfillJson(route, { detail: 'No model trained yet' }, 404),
  );
  await page.route(`${API_URL}/v1/users`, (route) => fulfillJson(route, USERS));
  await page.route(`${API_URL}/v1/users/page/*`, (route) =>
    fulfillJson(route, springPage(USERS)),
  );
  await page.route(`${API_URL}/v1/users/count`, (route) =>
    fulfillJson(route, { totalUsers: 2, activeUsers: 2, inactiveUsers: 0 }),
  );
  await page.route(`${API_URL}/v1/users/1`, (route) =>
    fulfillJson(route, ADMIN_USER),
  );
  await page.route(`${API_URL}/v1/roles`, (route) => fulfillJson(route, ROLES));
  await page.route(`${API_URL}/v1/permissions`, (route) =>
    fulfillJson(route, PERMISSIONS),
  );
  await page.route(`${API_URL}/v1/roles/*/permissions`, (route) => {
    if (route.request().method() === 'PUT') {
      const requested = (route.request().postDataJSON() ?? []) as string[];
      return fulfillJson(route, {
        ...USER_ROLE,
        permissions: PERMISSIONS.filter((p) => requested.includes(p.name)),
      });
    }
    return fulfillJson(route, USER_ROLE);
  });
}
