import { Pipe, PipeTransform } from '@angular/core';
import { formatCopCurrency } from '../utils/currency.utils';

@Pipe({
  name: 'copCurrency',
  standalone: true,
})
/** Pipe para formatear valores numéricos en pesos colombianos (COP). */
export class CopCurrencyPipe implements PipeTransform {
  /**
   * Convierte el valor recibido a formato monetario COP utilizando las opciones proporcionadas.
   *
   * @param value Valor numérico a formatear.
   * @param options Opciones adicionales para el formateador.
   */
  transform(
    value: number | null | undefined,
    options?: Partial<Intl.NumberFormatOptions>,
  ): string {
    return formatCopCurrency(value, options);
  }
}
