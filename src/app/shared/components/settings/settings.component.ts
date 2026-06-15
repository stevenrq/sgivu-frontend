import {
  Component,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../../features/auth/services/auth.service';
import { ThemePreference, ThemeService } from '../../services/theme.service';

/**
 * Página de configuración del perfil de usuario.
 * Muestra la información del usuario autenticado y permite
 * cambiar la preferencia de tema (claro, oscuro o sistema).
 */
@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  protected readonly currentUser = this.authService.currentAuthenticatedUser;
  protected readonly selectedTheme = computed(() =>
    this.themeService.preference(),
  );

  /**
   * Actualiza la preferencia de tema del usuario.
   *
   * @param preference - Nueva preferencia: `'light'`, `'dark'` o `'system'`.
   */
  onThemePreferenceChange(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }
}
