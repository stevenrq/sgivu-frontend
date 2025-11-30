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
/** Pipe para formatear fechas UTC al huso horario GMT-5 usado en SGIVU. */
export class UtcToGmtMinus5Pipe implements PipeTransform {
  /**
   * Convierte y formatea la fecha recibida a GMT-5 con el formato indicado.
   *
   * @param value Fecha en UTC o ISO.
   * @param format Formato opcional de salida.
   * @param locale Locale opcional.
   */
  transform(
    value: DateInput,
    format: string = DEFAULT_DISPLAY_DATE_FORMAT,
    locale?: string,
  ): string {
    return formatDisplayDate(value, format, locale);
  }
}
