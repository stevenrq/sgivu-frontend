import {
  ChangeDetectionStrategy,
  Component,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  formatCopNumber,
  normalizeMoneyInput,
} from '../../utils/currency.utils';

/**
 * Componente de entrada de rango (mínimo/máximo) con soporte para valores numéricos y precios COP.
 * En modo `'price'`, formatea y parsea los valores usando `normalizeMoneyInput` para dar
 * feedback visual inmediato con separadores de miles en formato colombiano.
 * Soporta two-way binding separado para `[(minValue)]` y `[(maxValue)]`.
 *
 * @example
 * ```html
 * <app-range-input
 *   label="Precio"
 *   inputType="price"
 *   [(minValue)]="minPrice"
 *   [(maxValue)]="maxPrice"
 * />
 * ```
 */
@Component({
  selector: 'app-range-input',
  templateUrl: './range-input.component.html',
  styleUrl: './range-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class RangeInputComponent implements OnChanges {
  /** Etiqueta visible sobre los dos inputs de rango. */
  readonly label = input.required<string>();

  /** Texto del input mínimo. */
  readonly minLabel = input<string>('Desde');

  /** Texto del input máximo. */
  readonly maxLabel = input<string>('Hasta');

  /**
   * Valor actual del mínimo.
   * Para 'price' puede ser un número; para 'number' es un número o null.
   */
  readonly minValue = input<number | string | null | undefined>(null);

  /** Valor actual del máximo. */
  readonly maxValue = input<number | string | null | undefined>(null);

  /**
   * Sufijo opcional que se muestra junto al input (p. ej. "km", "cc").
   * No aplica para 'price' que usa símbolo de moneda.
   */
  readonly unit = input<string | undefined>(undefined);

  /**
   * Tipo de input:
   * - 'number': input numérico estándar, emite número o null.
   * - 'price': input de texto con formato COP, emite número o null.
   */
  readonly inputType = input<'number' | 'price'>('number');

  /** Emite el nuevo valor mínimo (número o null si el campo está vacío). */
  readonly minValueChange = output<number | null>();

  /** Emite el nuevo valor máximo (número o null si el campo está vacío). */
  readonly maxValueChange = output<number | null>();

  /** Valor formateado que se muestra en el input mínimo (solo para 'price'). */
  protected displayMin = signal<string>('');

  /** Valor formateado que se muestra en el input máximo (solo para 'price'). */
  protected displayMax = signal<string>('');

  ngOnChanges(changes: SimpleChanges): void {
    if (this.inputType() !== 'price') {
      return;
    }
    // Sincronizar el display cuando el valor del padre cambia (p. ej. al limpiar o cargar desde URL).
    // Se formatea el número en COP para consistencia visual con el modo de edición.
    if (changes['minValue']) {
      this.displayMin.set(
        this.toDisplayPrice(changes['minValue'].currentValue),
      );
    }
    if (changes['maxValue']) {
      this.displayMax.set(
        this.toDisplayPrice(changes['maxValue'].currentValue),
      );
    }
  }

  private toDisplayPrice(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    return Number.isFinite(num) ? formatCopNumber(num) : String(value);
  }

  protected onNumberChange(field: 'min' | 'max', rawValue: unknown): void {
    const parsed =
      rawValue === '' || rawValue === null || rawValue === undefined
        ? null
        : Number(rawValue);
    const value = parsed !== null && !Number.isNaN(parsed) ? parsed : null;

    if (field === 'min') {
      this.minValueChange.emit(value);
    } else {
      this.maxValueChange.emit(value);
    }
  }

  protected onPriceInput(field: 'min' | 'max', rawValue: string): void {
    const { numericValue, displayValue } = normalizeMoneyInput(rawValue);

    if (field === 'min') {
      this.displayMin.set(displayValue);
      this.minValueChange.emit(numericValue);
    } else {
      this.displayMax.set(displayValue);
      this.maxValueChange.emit(numericValue);
    }
  }
}
