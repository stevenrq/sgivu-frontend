import { Pipe, PipeTransform } from '@angular/core';
import { formatCopCurrency } from '../utils/currency.utils';

@Pipe({
  name: 'copCurrency',
  standalone: true,
})
export class CopCurrencyPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    options?: Partial<Intl.NumberFormatOptions>,
  ): string {
    return formatCopCurrency(value, options);
  }
}
