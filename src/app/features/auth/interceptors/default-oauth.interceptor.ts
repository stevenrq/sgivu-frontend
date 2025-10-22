import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import {
  OAuthStorage,
  OAuthResourceServerErrorHandler,
  OAuthModuleConfig,
} from 'angular-oauth2-oidc';
import { AuthService } from '../services/auth.service';

export const defaultOAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authStorage = inject(OAuthStorage);
  const errorHandler = inject(OAuthResourceServerErrorHandler);
  const moduleConfig = inject(OAuthModuleConfig, { optional: true });
  const authService = inject(AuthService);

  const isUrlAllowed = (url: string): boolean =>
    moduleConfig?.resourceServer?.allowedUrls?.some((u) => url.startsWith(u)) ??
    false;

  if (
    !moduleConfig?.resourceServer?.allowedUrls ||
    !isUrlAllowed(req.url.toLowerCase())
  ) {
    return next(req);
  }

  if (moduleConfig.resourceServer.sendAccessToken) {
    const token = authStorage.getItem('access_token');
    req = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        console.error(
          'El token ha expirado o no es válido. Redirigiendo para iniciar sesión.',
        );
        authService.startLoginFlow();
      }
      return errorHandler.handleError(err);
    }),
  );
};
