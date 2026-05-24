import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import {
  ServiceHealthService,
  SKIP_HEALTH_HEADER,
} from '../../../shared/services/service-health.service';
import { environment } from '../../../../environments/environment';

/**
 * Interceptor HTTP para el patrón BFF.
 * Añade `withCredentials` para que la cookie de sesión del gateway viaje con cada request.
 * Captura errores 401 y redirige al flujo de login, excepto en:
 * - `/auth/session`: evita bucle infinito (el check inicial espera 401 si no hay sesión)
 * - `/logout`: el logout puede devolver 401 si la sesión ya expiró
 * - Peticiones con `SKIP_HEALTH_HEADER`: son health-checks internos; un 401 del gateway
 *   en `/actuator/health` NO significa sesión expirada sino que el endpoint está protegido.
 *   Sin esta exclusión, cada poll de `startHealthPolling` dispararía `startLoginFlow`,
 *   creando un bucle de redirección OAuth que recarga la página repetidamente.
 * - Cuando `ServiceHealthService` reporta el gateway como `'down'`: redirigir
 *   provocaría que `window.location.assign` apunte a un servicio inalcanzable y
 *   el usuario perdería la pantalla actual sin retroalimentación.
 *
 * @returns Observable que maneja la petición HTTP con credenciales y captura 401 para redirigir al login.
 */
export const defaultOAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const serviceHealth = inject(ServiceHealthService);
  const apiUrl = environment.apiUrl;

  if (!req.url.startsWith(apiUrl)) {
    return next(req);
  }

  const request = req.clone({ withCredentials: true });
  const isSessionCheck = req.url.includes('/auth/session');
  const isLogout = req.url.endsWith('/logout');
  const isHealthCheck = req.headers.has(SKIP_HEALTH_HEADER);

  return next(request).pipe(
    catchError((err) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !isSessionCheck &&
        !isLogout &&
        !isHealthCheck &&
        serviceHealth.gatewayStatus() !== 'down'
      ) {
        console.error('Session expired or invalid. Redirecting to login.');
        void authService.startLoginFlow(
          `${window.location.pathname}${window.location.search}`,
        );
      }
      return throwError(() => err);
    }),
  );
};
