import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página de error 403 — Acceso prohibido.
 * Se muestra cuando el usuario intenta acceder a un recurso
 * para el que no tiene los permisos necesarios.
 * Incluye un enlace para volver al dashboard.
 */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {}
