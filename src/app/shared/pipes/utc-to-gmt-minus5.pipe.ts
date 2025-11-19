import { Pipe, PipeTransform } from '@angular/core';
import {
  DateInput,
  DEFAULT_DISPLAY_DATE_FORMAT,
  formatDisplayDate,
} from '../utils/date.utils';

@Pipe({
  name: 'utcToGmtMinus5',
  standalone: true,
})
export class UtcToGmtMinus5Pipe implements PipeTransform {
  transform(
    value: DateInput,
    format: string = DEFAULT_DISPLAY_DATE_FORMAT,
    locale?: string,
  ): string {
    return formatDisplayDate(value, format, locale);
  }
}
