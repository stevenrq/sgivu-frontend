import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Overlay de carga semitransparente que cubre su contenedor posicionado.
 * Muestra un spinner Bootstrap con un mensaje de texto mientras se realiza
 * una operación asíncrona (carga de datos, envío de formulario, etc.).
 *
 * El componente padre debe tener `position: relative` para que el overlay
 * se posicione correctamente.
 */
@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  /** Texto descriptivo que se muestra bajo el spinner. */
  readonly label = input('Cargando...');
  /** Clase CSS de color para el spinner Bootstrap (e.g., `'text-primary'`, `'text-light'`). */
  readonly spinnerClass = input('text-primary');
}
