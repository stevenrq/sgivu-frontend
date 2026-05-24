import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { filter, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Guard que espera a que termine el `APP_INITIALIZER` de autenticación (`isDoneLoading$`)
 * antes de evaluar si el usuario está autenticado.
 * Sin `filter(isDone) → take(1)`, el guard se resolvería antes de que el servicio
 * valide la sesión con el gateway, rechazando usuarios válidos.
 *
 * @returns Observable<boolean> que indica si se permite la activación de la ruta.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  return authService.isDoneLoading$.pipe(
    filter((isDone) => isDone),
    take(1),
    switchMap(() => authService.enforceAuthentication(state.url)),
  );
};
