import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActiveFilterChip,
  QuickSuggestion,
} from '../../utils/quick-search.utils';

@Component({
  selector: 'app-quick-search-bar',
  templateUrl: './quick-search-bar.component.html',
  styleUrl: './quick-search-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class QuickSearchBarComponent {
  /** Texto placeholder del input de búsqueda. */
  readonly placeholder = input('Búsqueda rápida...');

  /** Valor actual del campo de búsqueda (soporte de two-way binding con [(searchValue)]). */
  readonly searchValue = input<string>('');

  /**
   * Lista de sugerencias de autocompletado calculadas por el componente padre.
   * Se muestran en un dropdown bajo el input.
   */
  readonly suggestions = input<QuickSuggestion[]>([]);

  /**
   * Chips de filtros activos (distintos del término de búsqueda) para mostrar
   * como badges dismissibles debajo del input.
   */
  readonly activeChips = input<ActiveFilterChip[]>([]);

  /** Emite el nuevo valor al escribir (soporte two-way binding). */
  readonly searchValueChange = output<string>();

  /** Emite cuando el usuario selecciona una sugerencia del dropdown. */
  readonly suggestionSelected = output<QuickSuggestion>();

  /** Emite el filterKey del chip que el usuario quiere eliminar. */
  readonly chipRemoved = output<string>();

  /** Emite al presionar Enter o al hacer clic en el ícono de búsqueda. */
  readonly searchSubmitted = output<void>();

  /** Emite al hacer clic en el botón X para limpiar el término de búsqueda. */
  readonly cleared = output<void>();

  /** Referencia al input nativo para manejar el foco. */
  private readonly inputRef =
    viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Controla si el dropdown de sugerencias está visible. */
  protected showDropdown = false;

  protected onInput(value: string): void {
    this.searchValueChange.emit(value);
    this.showDropdown = value.length > 0 && this.suggestions().length > 0;
  }

  protected onKeyEnter(): void {
    this.showDropdown = false;
    this.searchSubmitted.emit();
  }

  protected onClear(): void {
    this.searchValueChange.emit('');
    this.showDropdown = false;
    this.cleared.emit();
    this.inputRef()?.nativeElement.focus();
  }

  protected onSuggestionClick(suggestion: QuickSuggestion): void {
    this.showDropdown = false;
    this.suggestionSelected.emit(suggestion);
  }

  protected onChipRemove(filterKey: string): void {
    this.chipRemoved.emit(filterKey);
  }

  protected onSearchIconClick(): void {
    this.searchSubmitted.emit();
  }

  /** Cierra el dropdown si el usuario hace clic fuera del componente. */
  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    const el = target instanceof HTMLElement ? target : null;
    if (
      !this.inputRef()
        ?.nativeElement.closest('.quick-search-host')
        ?.contains(el)
    ) {
      this.showDropdown = false;
    }
  }
}
