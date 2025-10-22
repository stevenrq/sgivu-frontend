import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { filter, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  return authService.isDoneLoading$.pipe(
    filter((isDone) => isDone),
    take(1),
    switchMap(() => authService.enforceAuthentication(state.url)),
  );
};
