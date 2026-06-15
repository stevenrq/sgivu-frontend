import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Página de entrada al flujo de autenticación OAuth2.
 * Al inicializarse, redirige inmediatamente al gateway BFF para iniciar el flujo
 * de login — excepto cuando hay un logout pendiente (servicios estuvieron caídos
 * durante el logout), en cuyo caso el effect de `AuthService` se encargará de
 * completar el cierre real apenas vuelvan los servicios.
 *
 * @see {@link AuthService.startLoginFlow}
 */
@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    if (this.authService.logoutPending()) {
      return;
    }
    void this.authService.startLoginFlow();
  }
}
