import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Página de error 404 — Recurso no encontrado.
 * Se muestra cuando el usuario navega a una ruta que no existe.
 * Incluye un enlace para volver al inicio.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
