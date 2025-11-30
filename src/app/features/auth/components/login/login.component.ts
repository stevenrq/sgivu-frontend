import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
/**
 * Punto de entrada para iniciar el flujo OAuth; redirige al proveedor de identidad.
 */
export class LoginComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.startLoginFlow();
  }
}
