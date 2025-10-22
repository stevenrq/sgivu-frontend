import {
  ApplicationConfig,
  provideAppInitializer,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { OAuthStorage, provideOAuthClient } from 'angular-oauth2-oidc';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { defaultOAuthInterceptor } from './features/auth/interceptors/default-oauth.interceptor';
import { AuthService } from './features/auth/services/auth.service';
import { authModuleConfig } from './features/auth/config/auth-config';

export function storageFactory(): OAuthStorage {
  return localStorage;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([defaultOAuthInterceptor])),
    provideOAuthClient(authModuleConfig),
    provideCharts(withDefaultRegisterables()),
    {
      provide: OAuthStorage,
      useFactory: storageFactory,
    },
    provideAppInitializer(() => inject(AuthService).initializeAuthentication()),
  ],
};
