import { Pipe, PipeTransform } from '@angular/core';
import {
  DateInput,
  DEFAULT_DISPLAY_DATE_FORMAT,
  formatDisplayDate,
} from '../utils/date.utils';

/**
 * Pipe para convertir fechas UTC al huso horario GMT-5 (America/Bogota).
 * Aplica `normalizeUtcInput` antes de formatear para asegurar
 * interpretación UTC de strings ISO sin indicador de zona.
 *
 * @example
 * ```html
 * {{ '2024-06-15T14:30:00' | utcToGmtMinus5 }}
 * <!-- 15 jun 2024, 09:30 -->
 * ```
 */
@Pipe({
  name: 'utcToGmtMinus5',
  standalone: true,
})
export class UtcToGmtMinus5Pipe implements PipeTransform {
  /**
   * Formatea la fecha UTC en GMT-5.
   *
   * @param value - Fecha en cualquier formato admitido por `DateInput`.
   * @param format - Patrón de formato Angular (por defecto `'dd MMM yyyy, HH:mm'`).
   * @param locale - Locale de formato (por defecto `'es-CO'`).
   * @returns Cadena formateada en GMT-5, o vacía si el valor es inválido.
   */
  transform(
    value: DateInput,
    format: string = DEFAULT_DISPLAY_DATE_FORMAT,
    locale?: string,
  ): string {
    return formatDisplayDate(value, format, locale);
  }
}
