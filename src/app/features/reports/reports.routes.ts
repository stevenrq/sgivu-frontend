import { Routes } from '@angular/router';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { PermissionService } from '../auth/services/permission.service';

export const reportsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/reports-page/reports-page.component').then(
        (m) => m.ReportsPageComponent,
      ),
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('purchase_sale:read'),
    },
  },
];
