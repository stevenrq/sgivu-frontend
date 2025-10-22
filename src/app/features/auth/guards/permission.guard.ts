import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { inject } from '@angular/core';
import { map, Observable } from 'rxjs';

/**
 * Guard de permisos para rutas en Angular.
 *
 * Este guard utiliza una función personalizada definida en los `data` de la ruta (`canActivateFn`)
 * que recibe el `PermissionService` y retorna un `Observable<boolean>` indicando
 * si el usuario tiene permiso para acceder a la ruta.
 *
 * - Si `canActivateFn` no está definido en la ruta, el guard permite el acceso por defecto (`true`).
 * - Si la función retorna `true`, el acceso es concedido.
 * - Si la función retorna `false`, el guard redirige al usuario hacia la ruta `/forbidden`.
 *
 * ### Ejemplo de uso en el enrutador:
 * ```ts
 * {
 *   path: 'admin',
 *   component: AdminPageComponent,
 *   canActivate: [permissionGuard],
 *   data: {
 *     canActivateFn: (ps: PermissionService) =>
 *       ps.hasPermission$('user:read') // Devuelve Observable<boolean>
 *   }
 * }
 * ```
 *
 * @param route - Snapshot de la ruta actual que intenta activarse.
 * @param state - Estado actual del router.
 * @returns `true` si no hay validación definida.
 *          Un `Observable<boolean | UrlTree>` según el resultado de `canActivateFn`.
 */
export const permissionGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const canActivateFn: (ps: PermissionService) => Observable<boolean> =
    route.data['canActivateFn'];

  if (!canActivateFn) return true;

  return canActivateFn(permissionService).pipe(
    map((has) => (has ? true : router.parseUrl('/forbidden'))),
  );
};
