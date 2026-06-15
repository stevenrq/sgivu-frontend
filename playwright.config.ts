import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de la smoke suite e2e.
 *
 * Los tests corren contra `ng serve` (configuración development) con TODA la
 * red del gateway simulada vía `page.route()` (ver e2e/fixtures/api-mocks.ts):
 * no se necesita backend. Para una pasada manual contra el stack real,
 * levantar gateway+auth con Docker y ejecutar los flujos a mano (el login
 * OAuth/BFF no puede automatizarse headless sin backend).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
