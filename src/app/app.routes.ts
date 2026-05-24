import { Routes } from '@angular/router';
import { authGuard } from './features/auth/guards/auth.guard';
import { permissionGuard } from './features/auth/guards/permission.guard';
import { PermissionService } from './features/auth/services/permission.service';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./features/auth/components/callback/callback.component').then(
        (m) => m.CallbackComponent,
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/components/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/components/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:read'),
    },
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./features/users/user.routes').then((m) => m.userRoutes),
  },
  {
    path: 'clients',
    loadChildren: () =>
      import('./features/clients/client.routes').then((m) => m.clientRoutes),
  },
  {
    path: 'vehicles',
    loadChildren: () =>
      import('./features/vehicles/vehicle.routes').then((m) => m.vehicleRoutes),
  },
  {
    path: 'purchase-sales',
    loadChildren: () =>
      import('./features/purchase-sales/purchase-sales.routes').then(
        (m) => m.purchaseSalesRoutes,
      ),
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('./features/reports/reports.routes').then((m) => m.reportsRoutes),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
  },
  {
    path: 'roles-permissions',
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('role:update'),
    },
    loadComponent: () =>
      import('./features/users/components/roles-permissions/roles-permissions.component').then(
        (m) => m.RolesPermissionsComponent,
      ),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./shared/components/forbidden/forbidden.component').then(
        (m) => m.ForbiddenComponent,
      ),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
  { path: '**', redirectTo: '/dashboard' },
];
