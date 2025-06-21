import { Component } from '@angular/core';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar.component';
import { ChartExampleComponent } from '../chart-example/chart-example.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [NavbarComponent, ChartExampleComponent, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  constructor(private readonly router: Router) {}

  handleNavigationSelectChange(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    const routes: { [key: string]: string } = {
      profile: '/profile',
      task: '/task',
      auth: '/auth',
      settings: '/settings',
    };

    const route = routes[selectedValue];
    if (route) {
      this.router.navigate([route]);
    } else {
      console.warn(`No route defined for selection: ${selectedValue}`);
    }
  }
}
