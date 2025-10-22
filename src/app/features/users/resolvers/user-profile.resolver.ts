import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { User } from '../../../shared/models/user.model';
import { AuthService } from '../../auth/services/auth.service';

/**
 * Resolver que garantiza que los datos del perfil del usuario estén disponibles
 * antes de activar la ruta del perfil.
 *
 * Este resolver funciona en conjunto con el `APP_INITIALIZER` que intenta cargar
 * los datos del usuario al arrancar la aplicación. Su propósito es prevenir
 * que el componente de perfil se renderice antes de que los datos del usuario
 * estén listos, evitando así condiciones de carrera y errores de renderizado.
 *
 * @returns Un `Observable` que emite el objeto `User` si se encuentra,
 * o un `Observable` vacío (`EMPTY`) para cancelar la navegación si no se encuentra.
 */
export const userProfileResolver: ResolveFn<User> = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.getCurrentAuthenticatedUser();

  if (currentUser) {
    return of(currentUser);
  } else {
    console.error(
      'UserProfileResolver: No se pudo resolver el usuario. Redirigiendo al dashboard.',
    );
    router.navigate(['/dashboard']);

    return EMPTY;
  }
};
