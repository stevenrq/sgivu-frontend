import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Página de configuración general de la aplicación.
 * Reservada para opciones de configuración del sistema (en desarrollo).
 */
@Component({
  selector: 'app-configuration',
  imports: [],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationComponent {}
