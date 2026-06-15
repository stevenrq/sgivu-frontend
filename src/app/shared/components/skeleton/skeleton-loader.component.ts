import { Component, input, ChangeDetectionStrategy } from '@angular/core';

type SkeletonVariant =
  | 'text'
  | 'card'
  | 'table-row'
  | 'chart'
  | 'pie-chart'
  | 'circle';

/**
 * Componente de skeleton loader reutilizable.
 *
 * Muestra un placeholder animado con efecto shimmer que imita
 * la forma del contenido real mientras se carga.
 *
 * Variantes disponibles:
 * - `text`: Líneas de texto (configurable con `count`)
 * - `card`: Una tarjeta completa (icono + título + valor)
 * - `table-row`: Filas de tabla (configurable con `count`)
 * - `chart`: Placeholder para un gráfico
 * - `circle`: Círculo (avatar, ícono)
 */
@Component({
  selector: 'app-skeleton-loader',
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoaderComponent {
  /** Variante visual del skeleton: `'text'`, `'card'`, `'table-row'`, `'chart'`, `'pie-chart'` o `'circle'`. */
  readonly variant = input<SkeletonVariant>('text');
  /** Número de elementos a renderizar (filas de texto o filas de tabla). */
  readonly count = input(1);
  /** Ancho personalizado del skeleton (e.g., `'200px'`, `'50%'`). */
  readonly width = input<string | undefined>(undefined);
  /** Alto personalizado del skeleton (e.g., `'100px'`). */
  readonly height = input<string | undefined>(undefined);

  /** Arreglo de índices para iterar los elementos del skeleton en el template. */
  get items(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
