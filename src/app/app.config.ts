import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZonelessChangeDetection,
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
 * Change detection ZONELESS (sin zone.js): todos los componentes usan OnPush y
 * estado basado en señales (signal/computed/effect). Los pocos estados mutables
 * que se actualizaban en callbacks asíncronos (filtros de listados, query params,
 * inputs de precio y los getters sobre FormControl de los formularios de
 * compra/venta) se migraron a señales y a `toSignal(valueChanges)`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
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
