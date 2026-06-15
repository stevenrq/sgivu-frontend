import { Routes } from '@angular/router';
import { UserListComponent } from './components/user-list/user-list.component';
import { UserFormComponent } from './components/user-form/user-form.component';
import { authGuard } from '../auth/guards/auth.guard';
import { permissionGuard } from '../auth/guards/permission.guard';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { userProfileResolver } from './resolvers/user-profile.resolver';
import { PermissionService } from '../auth/services/permission.service';

export const userRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'page/0',
  },
  {
    path: 'create',
    component: UserFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:create'),
    },
  },
  {
    path: 'profile',
    component: UserProfileComponent,
    canActivate: [authGuard],
    resolve: {
      user: userProfileResolver,
    },
  },
  {
    path: 'profile/edit',
    component: UserFormComponent,
    canActivate: [authGuard],
    data: { selfEdit: true },
  },
  {
    path: 'profile/:id',
    component: UserProfileComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:update'),
    },
  },
  {
    path: 'page/:page',
    component: UserListComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:read'),
    },
  },
  {
    path: ':id',
    component: UserFormComponent,
    canActivate: [authGuard, permissionGuard],
    data: {
      canActivateFn: (ps: PermissionService) => ps.hasPermission('user:update'),
    },
  },
  {
    path: '**',
    redirectTo: 'page/0',
  },
];
