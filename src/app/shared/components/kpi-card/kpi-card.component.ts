import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/** Variante de color del KPI card, mapea a clases Bootstrap de color. */
type KpiVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'dark';

/**
 * Tarjeta de indicador clave de rendimiento (KPI).
 * Muestra un icono, una etiqueta, un valor numérico/textual y una descripción opcional.
 * Se usa en el dashboard y en las cabeceras de listas para mostrar conteos de entidades.
 *
 * @example
 * ```html
 * <app-kpi-card label="Total" [value]="total()" icon="bi-people" variant="primary" />
 * ```
 */
@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  /** Etiqueta descriptiva del indicador (e.g., `'Total'`, `'Activos'`). */
  readonly label = input.required<string>();
  /** Valor principal a mostrar. `null` muestra un guion o placeholder. */
  readonly value = input<string | number | null>(null);
  /** Texto secundario con contexto adicional (opcional). */
  readonly description = input<string | undefined>();
  /** Clase CSS de icono Bootstrap (por defecto `'bi-info-circle'`). */
  readonly icon = input('bi-info-circle');
  /** Variante de color Bootstrap que define el esquema visual de la tarjeta. */
  readonly variant = input<KpiVariant>('primary');
}
