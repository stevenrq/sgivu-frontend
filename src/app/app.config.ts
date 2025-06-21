import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { OAuthStorage, provideOAuthClient } from 'angular-oauth2-oidc';
import { authModuleConfig } from './core/auth-module-config';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export function storageFactory(): OAuthStorage {
  return localStorage;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideOAuthClient(authModuleConfig),
    provideCharts(withDefaultRegisterables()),
    {
      provide: OAuthStorage,
      useFactory: storageFactory,
    },
  ],
};
