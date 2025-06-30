import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/components/home/home.component';
import { DashboardComponent } from './features/dashboard/components/dashboard/dashboard.component';
import { ForbiddenComponent } from './shared/components/forbidden/forbidden.component';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: HomeComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'forbidden',
    component: ForbiddenComponent,
  },
  { path: '**', component: NotFoundComponent },
];
