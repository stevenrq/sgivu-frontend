import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ActiveFilterChip,
  QuickSuggestion,
} from '../../utils/quick-search.utils';
import { QuickSearchBarComponent } from '../quick-search-bar/quick-search-bar.component';

/**
 * Toolbar estándar de los listados: barra de búsqueda rápida, botón
 * "Más filtros" con contador y panel colapsable de filtros avanzados.
 *
 * El contenido del panel es específico de cada listado y se proyecta con el
 * atributo `advanced-filters`:
 *
 * ```html
 * <app-list-toolbar [searchValue]="..." (applied)="applyFilters()">
 *   <div advanced-filters class="row g-3 align-items-end">…campos…</div>
 * </app-list-toolbar>
 * ```
 *
 * La visibilidad del panel es estado interno (signal): los listados ya no
 * necesitan la propiedad mutable `showAdvancedFilters`.
 */
@Component({
  selector: 'app-list-toolbar',
  imports: [QuickSearchBarComponent],
  templateUrl: './list-toolbar.component.html',
  styleUrl: './list-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListToolbarComponent {
  /** Placeholder del input de búsqueda rápida. */
  readonly placeholder = input('Búsqueda rápida...');

  /** Valor actual del término de búsqueda. */
  readonly searchValue = input<string>('');

  /** Sugerencias para el dropdown de búsqueda (opcional). */
  readonly suggestions = input<QuickSuggestion[]>([]);

  /** Chips de filtros activos mostrados bajo el input. */
  readonly activeChips = input<ActiveFilterChip[]>([]);

  /** Cantidad de filtros avanzados activos (badge del botón "Más filtros"). */
  readonly advancedFiltersCount = input(0);

  /** Cambio del término de búsqueda. */
  readonly searchValueChange = output<string>();

  /** Sugerencia seleccionada del dropdown. */
  readonly suggestionSelected = output<QuickSuggestion>();

  /** Búsqueda enviada (Enter o icono). */
  readonly searchSubmitted = output<void>();

  /** Término de búsqueda limpiado. */
  readonly cleared = output<void>();

  /** Chip de filtro activo eliminado (emite la clave del filtro). */
  readonly chipRemoved = output<string>();

  /** Click en "Aplicar". */
  readonly applied = output<void>();

  /** Visibilidad del panel de filtros avanzados. */
  protected readonly showAdvancedFilters = signal(false);

  protected toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((visible) => !visible);
  }
}
