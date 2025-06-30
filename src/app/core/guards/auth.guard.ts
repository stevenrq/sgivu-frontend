import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { tap } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  return authService.canActivateProtectedRoutes$.pipe(
    tap((canActivate) => {
      if (!canActivate) {
        authService.login(state.url);
      }
      return true;
    }),
  );
};
