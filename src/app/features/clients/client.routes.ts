import { Routes } from '@angular/router';
import { ClientListComponent } from './components/client-list/client-list.component';
import { ClientFormComponent } from './components/client-form/client-form.component';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { PermissionService } from '../auth/services/permission.service';

export const clientRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'persons/page/0',
  },
  {
    path: 'persons/create',
    component: ClientFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'person',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('person:create'),
    },
  },
  {
    path: 'persons',
    pathMatch: 'full',
    redirectTo: 'persons/page/0',
  },
  {
    path: 'companies',
    pathMatch: 'full',
    redirectTo: 'companies/page/0',
  },
  {
    path: 'create',
    component: ClientFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'person',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('person:create'),
    },
  },
  {
    path: 'page/:page',
    pathMatch: 'full',
    redirectTo: 'persons/page/:page',
  },
  {
    path: 'companies/create',
    component: ClientFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'company',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('company:create'),
    },
  },
  {
    path: 'persons/page/:page',
    component: ClientListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'person',
      canActivateFn: (ps: PermissionService) => ps.hasPermission('person:read'),
    },
  },
  {
    path: 'companies/page/:page',
    component: ClientListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'company',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('company:read'),
    },
  },
  {
    path: 'persons/:id',
    component: ClientFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'person',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('person:update'),
    },
  },
  {
    path: 'companies/:id',
    component: ClientFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      clientType: 'company',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('company:update'),
    },
  },
  {
    path: '**',
    redirectTo: 'persons/page/0',
  },
];
