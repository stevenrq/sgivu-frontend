import { Component, OnInit } from '@angular/core';
import { User } from '../../../features/users/models/user.model';
import { AuthService } from '../../../features/auth/services/auth.service';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  protected user: User | null = null;

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentAuthenticatedUser$.subscribe({
      next: (user) => {
        this.user = user;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }
}
