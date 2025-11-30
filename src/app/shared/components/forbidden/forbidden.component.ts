import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.css',
})
/** Mensaje de acceso denegado con opción para volver al inicio. */
export class ForbiddenComponent {}
