import { formatDate } from '@angular/common';

/** Valor de fecha admitido por los formateadores utilitarios. */
export type DateInput = string | number | Date | null | undefined;

const DEFAULT_FORMAT = 'short';
const DEFAULT_LOCALE = 'es-CO';
export const DEFAULT_DISPLAY_DATE_FORMAT = 'dd MMM yyyy, HH:mm';
export const GMT_MINUS_5_TIMEZONE = 'America/Bogota';

const UTC_GUARD_REGEX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T\s]/;

/**
 * Asegura que strings ISO sin indicador de zona se interpreten como UTC.
 * Las fechas del backend llegan como `2024-01-15T10:30:00` (sin Z),
 * y `new Date()` las interpretaría como hora local sin esta normalización.
 *
 * @param value El string de fecha a normalizar.
 * @returns El string normalizado con 'T' como separador y 'Z' si no tiene zona.
 */
function normalizeUtcInput(value: string): string {
  if (!ISO_DATETIME_REGEX.test(value)) {
    return value;
  }

  const sanitizedValue = value.replace(' ', 'T');
  if (UTC_GUARD_REGEX.test(sanitizedValue)) {
    return sanitizedValue;
  }

  return `${sanitizedValue}Z`;
}

/**
 * Convierte cualquier entrada de fecha a un objeto `Date` normalizado.
 * Aplica `normalizeUtcInput` a strings para garantizar interpretación UTC.
 *
 * @param dateValue - Valor de fecha a convertir.
 * @returns Objeto `Date` válido, o `null` si el valor es nulo o inválido.
 */
function toDate(dateValue: DateInput): Date | null {
  if (dateValue === null || dateValue === undefined) {
    return null;
  }

  let parsedDate: Date;
  if (dateValue instanceof Date) {
    parsedDate = dateValue;
  } else if (typeof dateValue === 'string') {
    parsedDate = new Date(normalizeUtcInput(dateValue));
  } else {
    parsedDate = new Date(dateValue);
  }

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
 * Convierte una entrada de fecha a un objeto `Date` interpretado como UTC.
 *
 * @param dateValue - Valor de fecha en cualquier formato admitido.
 * @returns Objeto `Date` en UTC, o `null` si el valor es inválido.
 */
export function parseUtcDate(dateValue: DateInput): Date | null {
  return toDate(dateValue);
}

/**
 * Formatea una fecha UTC al huso horario GMT-5 (America/Bogota) usando `formatDate` de Angular.
 *
 * @param dateValue - Valor de fecha a formatear.
 * @param format - Patrón de formato Angular (por defecto `'short'`).
 * @param locale - Locale para el formato (por defecto `'es-CO'`).
 * @returns Cadena formateada en GMT-5, o cadena vacía si el valor es inválido.
 */
export function formatUtcToGmtMinus5(
  dateValue: DateInput,
  format: string = DEFAULT_FORMAT,
  locale: string = DEFAULT_LOCALE,
): string {
  const normalizedDate = toDate(dateValue);
  if (!normalizedDate) {
    return '';
  }

  return formatDate(normalizedDate, format, locale, GMT_MINUS_5_TIMEZONE);
}

/**
 * Formatea una fecha UTC con el formato de visualización estándar `'dd MMM yyyy, HH:mm'` en GMT-5.
 * Atajo sobre `formatUtcToGmtMinus5` para uso en templates y pipes.
 *
 * @param dateValue - Valor de fecha a formatear.
 * @param format - Patrón de formato (por defecto `DEFAULT_DISPLAY_DATE_FORMAT`).
 * @param locale - Locale para el formato (por defecto `'es-CO'`).
 * @returns Cadena formateada en GMT-5, o cadena vacía si el valor es inválido.
 */
export function formatDisplayDate(
  dateValue: DateInput,
  format: string = DEFAULT_DISPLAY_DATE_FORMAT,
  locale: string = DEFAULT_LOCALE,
): string {
  return formatUtcToGmtMinus5(dateValue, format, locale);
}
