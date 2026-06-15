import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SKIP_HEALTH_HEADER,
  ServiceHealthService,
} from '../services/service-health.service';

/**
 * Interceptor que detecta de forma reactiva la indisponibilidad de los microservicios
 * dependientes del frontend (`sgivu-gateway` y `sgivu-auth`).
 *
 * - Marca `gateway` como **UP** ante cualquier respuesta HTTP del gateway
 *   (incluyendo 4xx). Marca `gateway` como **DOWN** ante errores de red
 *   (`status === 0`), `504 Gateway Timeout`, o `502/503` en rutas que no son de auth.
 * - Marca `auth` como **DOWN** ante `502/503` sobre rutas `/auth/*` u `/oauth2/*`,
 *   que sí prueban que el gateway no pudo contactar al auth server.
 * - **No** marca `auth` como UP a partir de respuestas exitosas: el gateway puede
 *   responder a `/auth/session` con `200` desde la sesión Redis incluso si
 *   `sgivu-auth` está caído. El estado UP del auth lo establece únicamente el
 *   probe directo (`ServiceHealthService.checkAuthHealthDirect`).
 *
 * Las peticiones que llevan el header `SKIP_HEALTH_HEADER` (las del propio
 * `ServiceHealthService`) se ignoran para evitar bucles.
 */
export const serviceHealthInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = environment.apiUrl;

  if (!req.url.startsWith(apiUrl) || req.headers.has(SKIP_HEALTH_HEADER)) {
    return next(req);
  }

  const serviceHealth = inject(ServiceHealthService);
  const isAuthUrl = req.url.includes('/auth/') || req.url.includes('/oauth2/');
  const isMlUrl = req.url.includes('/v1/ml/');

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        serviceHealth.markGatewayUp();
      }
    }),
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const { status } = err;
        // 504 en rutas ML es timeout del servicio ML, no fallo del gateway
        if (status === 0 || (status === 504 && !isMlUrl)) {
          serviceHealth.markGatewayDown();
        } else if ((status === 502 || status === 503) && isAuthUrl) {
          serviceHealth.markAuthDown();
        } else if (status === 502 || status === 503) {
          serviceHealth.markGatewayDown();
        } else if (status >= 200 && status < 500) {
          // Cualquier otra respuesta HTTP del gateway confirma que está vivo.
          serviceHealth.markGatewayUp();
        }
      }
      return throwError(() => err);
    }),
  );
};
