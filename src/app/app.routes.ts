import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/components/dashboard/dashboard.component';
import { ForbiddenComponent } from './shared/components/forbidden/forbidden.component';
import { authGuard } from './features/auth/guards/auth.guard';
import { userRoutes } from './features/users/user.routes';
import { permissionGuard } from './features/auth/guards/permission.guard';
import { LoginComponent } from './features/auth/components/login/login.component';
import { CallbackComponent } from './features/auth/components/callback/callback.component';
import { RolesPermissionsComponent } from './features/users/components/roles-permissions/roles-permissions.component';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { SettingsComponent } from './shared/components/settings/settings.component';
import { PermissionService } from './features/auth/services/permission.service';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'callback',
    component: CallbackComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:read'),
    },
  },
  {
    path: 'users',
    children: userRoutes,
  },
  {
    path: 'settings',
    canActivate: [authGuard, permissionGuard],
    component: SettingsComponent,
  },
  {
    path: 'roles-permissions',
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('role:update'),
    },
    component: RolesPermissionsComponent,
  },
  {
    path: 'forbidden',
    component: ForbiddenComponent,
  },
  { path: 'not-found', component: NotFoundComponent },
  { path: '**', redirectTo: '/dashboard' },
];
