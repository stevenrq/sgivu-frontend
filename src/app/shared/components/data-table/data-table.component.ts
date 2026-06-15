import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';
import { SkeletonLoaderComponent } from '../skeleton/skeleton-loader.component';

@Component({
  selector: 'app-data-table',
  imports: [LoadingOverlayComponent, SkeletonLoaderComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  readonly loading = input(false);
  readonly minHeight = input(260);
  readonly responsive = input(true);
  readonly showHeader = input(true);
  readonly loadingLabel = input('Cargando datos...');
  readonly useSkeleton = input(true);
  readonly skeletonRows = input(5);

  /** Filas con color alternado en lugar de hover. */
  readonly striped = input(false);
  /** Padding reducido (table-sm de Bootstrap), activo por defecto. */
  readonly compact = input(true);
  /** Encabezado fijo al hacer scroll (se activa automáticamente con maxHeight). */
  readonly stickyHeader = input(false);
  /** Altura máxima en px para scroll vertical del cuerpo de la tabla. */
  readonly maxHeight = input<number | null>(480);
  /** Quita el borde, sombra y fondo del wrapper; útil dentro de tarjetas Bootstrap. */
  readonly flat = input(false);
  /** Clases CSS adicionales para el elemento <table> (ej. 'table-bordered'). */
  readonly tableClass = input('');

  /** Indica si la tabla debe fijar el encabezado por tener scroll interno. */
  readonly stickyHeaderEnabled = computed(
    () => this.stickyHeader() || this.maxHeight() !== null,
  );

  /** Clase del <table> construida desde los inputs; no necesita pasarse manualmente. */
  readonly resolvedTableClass = computed(() => {
    const classes = ['table', 'align-middle', 'mb-0'];
    if (this.striped()) {
      classes.push('table-striped');
    } else {
      classes.push('table-hover');
    }
    if (this.compact()) classes.push('table-sm');
    if (this.tableClass()) classes.push(this.tableClass());
    return classes.join(' ');
  });

  get skeletonItems(): number[] {
    return Array.from({ length: this.skeletonRows() }, (_, i) => i);
  }
}
