import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Página de callback OAuth2. Recibe el código de autorización del gateway
 * e inicia la validación de sesión mediante `AuthService.initializeAuthentication()`.
 * El guard `authGuard` espera a que este proceso termine antes de evaluar rutas protegidas.
 *
 * @see {@link AuthService.initializeAuthentication}
 */
@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.initializeAuthentication();
  }
}
