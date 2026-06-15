import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Encabezado estándar de página con título, subtítulo y texto de eyebrow.
 * Se usa en la parte superior de las vistas de listado, detalle y formulario.
 *
 * @example
 * ```html
 * <app-page-header title="Vehículos" subtitle="Gestión del inventario" eyebrow="Catálogo" />
 * ```
 */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  /** Título principal de la página. */
  readonly title = input.required<string>();
  /** Subtítulo o descripción breve de la sección. */
  readonly subtitle = input<string | undefined>();
  /** Texto pequeño sobre el título (breadcrumb o categoría). */
  readonly eyebrow = input<string | undefined>();
}
