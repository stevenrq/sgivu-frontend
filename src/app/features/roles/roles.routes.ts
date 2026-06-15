import { Routes } from '@angular/router';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { PermissionService } from '../auth/services/permission.service';

/**
 * Rutas de la gestión de roles y permisos.
 * Las autoridades coinciden con las exigidas por el backend (`user:read` para ver,
 * `user:read` + `user:update` para editar los permisos de un rol).
 */
export const rolesRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:read'),
    },
    loadComponent: () =>
      import('./components/role-list/role-list.component').then(
        (m) => m.RoleListComponent,
      ),
  },
  {
    path: ':id/permissions',
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) =>
        ps.hasAllPermissions(['user:read', 'user:update']),
    },
    loadComponent: () =>
      import('./components/role-permissions-editor/role-permissions-editor.component').then(
        (m) => m.RolePermissionsEditorComponent,
      ),
  },
];
