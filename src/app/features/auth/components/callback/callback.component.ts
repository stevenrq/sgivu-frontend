import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.css',
})
/**
 * Maneja el redireccionamiento de OAuth2. Completa el flujo de autenticación
 * al volver del proveedor e inicializa la sesión en la aplicación.
 */
export class CallbackComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.initializeAuthentication();
  }
}
