import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';

/**
 * Componente contenedor estándar para formularios de creación/edición.
 * Proyecta el cuerpo del formulario y los botones de acción (footer),
 * y muestra un overlay de carga mientras se procesa el envío.
 *
 * @example
 * ```html
 * <app-form-shell title="Nuevo usuario" icon="bi-person-plus" [loading]="submitting()">
 *   <form>...</form>
 *   <ng-container slot="footer">
 *     <button type="submit">Guardar</button>
 *   </ng-container>
 * </app-form-shell>
 * ```
 */
@Component({
  selector: 'app-form-shell',
  imports: [LoadingOverlayComponent],
  templateUrl: './form-shell.component.html',
  styleUrl: './form-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormShellComponent {
  /** Título principal del formulario. */
  readonly title = input('');
  /** Subtítulo o descripción breve del formulario. */
  readonly subtitle = input('');
  /** Clase CSS de icono Bootstrap a mostrar junto al título (e.g., `'bi-person-plus'`). */
  readonly icon = input('');
  /** Si es `true`, muestra el overlay de carga sobre el formulario. */
  readonly loading = input(false);
  /** Clases CSS adicionales para el contenedor de página. */
  readonly pageClass = input('');
  /** Clases CSS adicionales para la tarjeta del formulario. */
  readonly cardClass = input('');
  /** Clases CSS adicionales para el encabezado de la tarjeta. */
  readonly headerClass = input('');
  /** Clases CSS adicionales para el pie de la tarjeta. */
  readonly footerClass = input('');
  /** Clases CSS adicionales para el título. */
  readonly titleClass = input('');
  /** Clases CSS adicionales para el subtítulo. */
  readonly subtitleClass = input('');
  /** Clases CSS adicionales para el cuerpo de la tarjeta. */
  readonly bodyClass = input('');
}
