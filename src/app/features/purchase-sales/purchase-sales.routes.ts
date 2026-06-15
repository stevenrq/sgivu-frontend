import { Routes } from '@angular/router';
import { PurchaseSaleListComponent } from './components/purchase-sale-list/purchase-sale-list.component';
import { PurchaseSaleCreateComponent } from './components/purchase-sale-create/purchase-sale-create.component';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { PermissionService } from '../auth/services/permission.service';
import { PurchaseSaleDetailComponent } from './components/purchase-sale-detail/purchase-sale-detail.component';

export const purchaseSalesRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'page/0',
  },
  {
    path: 'page/:page',
    component: PurchaseSaleListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('purchase_sale:read'),
    },
  },
  {
    path: 'register',
    component: PurchaseSaleCreateComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('purchase_sale:create'),
    },
  },
  {
    path: 'details/:id',
    component: PurchaseSaleDetailComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) =>
        ps.hasPermission('purchase_sale:read'),
    },
  },
  {
    path: '**',
    redirectTo: 'page/0',
  },
];
