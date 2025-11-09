import { Pipe, PipeTransform } from '@angular/core';
import {
  DateInput,
  formatUtcToGmtMinus5,
} from '../utils/date.utils';

@Pipe({
  name: 'utcToGmtMinus5',
  standalone: true,
})
export class UtcToGmtMinus5Pipe implements PipeTransform {
  transform(
    value: DateInput,
    format?: string,
    locale?: string,
  ): string {
    return formatUtcToGmtMinus5(value, format, locale);
  }
}
