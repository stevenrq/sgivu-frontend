import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideCharts } from 'ng2-charts';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { defaultOAuthInterceptor } from './features/auth/interceptors/default-oauth.interceptor';
import { serviceHealthInterceptor } from './shared/interceptors/service-health.interceptor';
import { AuthService } from './features/auth/services/auth.service';
import { ThemeService } from './shared/services/theme.service';

/**
 * Configuración principal de la aplicación.
 *
 * PREPARACIÓN PARA ZONELESS CHANGE DETECTION
 * ───────────────────────────────────────────
 * El proyecto está preparado para migrar a Zoneless. La mayoría de los
 * componentes ya usan señales (signal/computed/effect) y OnPush. Para
 * activar Zoneless:
 *
 * 1. Reemplazar `provideZoneChangeDetection()` por `provideZonelessChangeDetection()`
 * 2. Eliminar `zone.js` del array `polyfills` en `angular.json`
 * 3. Desinstalar el paquete: `npm uninstall zone.js`
 *
 * Propiedades mutables pendientes de convertir a signal (~20 en 8 componentes):
 * - `filters` (ngModel binding) en los 6 componentes de listado
 * - `queryParams`/`pagerQueryParams` mutados en callbacks subscribe()
 * - `priceInputs` en car-list y motorcycle-list
 * - `quickSuggestions`, `reportStartDate`, `reportEndDate` en purchase-sale-list
 * - Getters sobre FormControl.value en purchase-sale-create y purchase-vehicle-form
 * - `vehicleSalePriceInput`, `vehicleMileageInput` en purchase-vehicle-form
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Orden: `defaultOAuth` envuelve a `serviceHealth` (más cercano al backend), por lo
    // que `serviceHealth` marca el estado antes de que `defaultOAuth` decida si redirigir.
    provideHttpClient(
      withInterceptors([defaultOAuthInterceptor, serviceHealthInterceptor]),
    ),
    // Tree-shaking de Chart.js: registramos sólo los controllers/elementos/escalas/plugins
    // que realmente usamos (line+bar+doughnut). Ahorra ~60 KB vs withDefaultRegisterables().
    provideCharts({
      registerables: [
        LineController,
        BarController,
        DoughnutController,
        LineElement,
        PointElement,
        BarElement,
        ArcElement,
        LinearScale,
        CategoryScale,
        Legend,
        Tooltip,
        Title,
        Filler,
      ],
    }),
    {
      provide: LOCALE_ID,
      useValue: 'es-CO',
    },
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideAppInitializer(() => inject(AuthService).initializeAuthentication()),
  ],
};
