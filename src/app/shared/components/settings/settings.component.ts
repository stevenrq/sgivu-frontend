import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { User } from '../../../features/users/models/user.model';
import { AuthService } from '../../../features/auth/services/auth.service';
import {
  ThemePreference,
  ThemeService,
} from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
/** Vista de ajustes personales que permite cambiar el tema y muestra datos del usuario actual. */
export class SettingsComponent implements OnInit {
  protected user: User | null = null;
  protected selectedTheme: ThemePreference = 'system';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly authService: AuthService,
    private readonly themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.selectedTheme = this.themeService.currentPreference;

    this.themeService.preference$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((preference) => {
        this.selectedTheme = preference;
      });

    this.authService.currentAuthenticatedUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user = user;
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  onThemePreferenceChange(preference: ThemePreference): void {
    this.selectedTheme = preference;
    this.themeService.setPreference(preference);
  }
}
