import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/** Opción individual para el grupo de chips de filtro. */
export interface ChipOption<T = unknown> {
  /** Valor que se emite al seleccionar la opción. */
  value: T;
  /** Texto visible en el chip. */
  label: string;
  /** Clase CSS adicional para el chip (p. ej. clases de color para estados). */
  badgeClass?: string;
}

/**
 * Grupo de chips de filtro de selección única.
 * Siempre incluye un chip "Todos" que limpia el filtro activo.
 * Seleccionar el chip activo vuelve al estado "Todos" (deselección por click).
 * Soporta two-way binding con `[(selected)]`.
 *
 * @example
 * ```html
 * <app-filter-chip-group
 *   label="Estado"
 *   [options]="statusOptions"
 *   [(selected)]="selectedStatus"
 * />
 * ```
 */
@Component({
  selector: 'app-filter-chip-group',
  templateUrl: './filter-chip-group.component.html',
  styleUrl: './filter-chip-group.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
})
export class FilterChipGroupComponent {
  /** Etiqueta opcional que se muestra sobre el grupo de chips. */
  readonly label = input<string | undefined>(undefined);

  /** Lista de opciones a renderizar como chips. */
  readonly options = input.required<ChipOption[]>();

  /** Valor actualmente seleccionado. */
  readonly selected = input<unknown>(null);

  /** Texto del chip que representa "sin filtro" (todos). */
  readonly allLabel = input<string>('Todos');

  /** Valor que representa "sin filtro" (todos). Cuando se selecciona, se emite este valor. */
  readonly allValue = input<unknown>(null);

  /** Emite el valor seleccionado (soporte two-way binding con [(selected)]). */
  readonly selectedChange = output<unknown>();

  protected onSelect(value: unknown): void {
    // Seleccionar el chip ya activo lo deselecciona (vuelve a allValue)
    const next = value === this.selected() ? this.allValue() : value;
    this.selectedChange.emit(next);
  }

  protected isSelected(value: unknown): boolean {
    return this.selected() === value;
  }

  protected isAllSelected(): boolean {
    const sel = this.selected();
    return (
      sel === this.allValue() || sel === null || sel === '' || sel === undefined
    );
  }
}
