import { Pipe, PipeTransform } from '@angular/core';
import { formatCopCurrency } from '../utils/currency.utils';

/**
 * Pipe para formatear valores numéricos en pesos colombianos (COP).
 * Usa `Intl.NumberFormat` con locale `es-CO` y símbolo de moneda `COP`.
 * Retorna cadena vacía para valores `null`, `undefined` o `NaN`.
 *
 * @example
 * ```html
 * {{ 1500000 | copCurrency }}  <!-- $ 1.500.000 -->
 * ```
 */
@Pipe({
  name: 'copCurrency',
  standalone: true,
})
export class CopCurrencyPipe implements PipeTransform {
  /**
   * Formatea el valor numérico como moneda COP.
   *
   * @param value - Número a formatear.
   * @param options - Opciones adicionales de `Intl.NumberFormatOptions` (opcional).
   * @returns Cadena formateada como COP, o vacía si el valor es inválido.
   */
  transform(
    value: number | null | undefined,
    options?: Partial<Intl.NumberFormatOptions>,
  ): string {
    return formatCopCurrency(value, options);
  }
}
