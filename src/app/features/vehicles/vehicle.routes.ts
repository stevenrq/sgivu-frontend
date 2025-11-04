import { Routes } from '@angular/router';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { PermissionService } from '../auth/services/permission.service';
import { VehicleListComponent } from './components/vehicle-list/vehicle-list.component';
import { VehicleFormComponent } from './components/vehicle-form/vehicle-form.component';

export const vehicleRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'cars/page/0',
  },
  {
    path: 'page/:page',
    pathMatch: 'full',
    redirectTo: 'cars/page/:page',
  },
  {
    path: 'cars',
    pathMatch: 'full',
    redirectTo: 'cars/page/0',
  },
  {
    path: 'motorcycles',
    pathMatch: 'full',
    redirectTo: 'motorcycles/page/0',
  },
  {
    path: 'cars/page/:page',
    component: VehicleListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'car',
      canActivateFn: (ps: PermissionService) => ps.hasPermission('car:read'),
    },
  },
  {
    path: 'motorcycles/page/:page',
    component: VehicleListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'motorcycle',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('motorcycle:read'),
    },
  },
  {
    path: 'cars/create',
    component: VehicleFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'car',
      canActivateFn: (ps: PermissionService) => ps.hasPermission('car:create'),
    },
  },
  {
    path: 'motorcycles/create',
    component: VehicleFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'motorcycle',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('motorcycle:create'),
    },
  },
  {
    path: 'cars/:id',
    component: VehicleFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'car',
      canActivateFn: (ps: PermissionService) => ps.hasPermission('car:update'),
    },
  },
  {
    path: 'motorcycles/:id',
    component: VehicleFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      vehicleType: 'motorcycle',
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('motorcycle:update'),
    },
  },
  {
    path: '**',
    redirectTo: 'cars/page/0',
  },
];

