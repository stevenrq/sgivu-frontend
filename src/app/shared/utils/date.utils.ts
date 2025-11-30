import { formatDate } from '@angular/common';

/** Valor de fecha admitido por los formateadores utilitarios. */
export type DateInput = string | number | Date | null | undefined;

const DEFAULT_FORMAT = 'short';
const DEFAULT_LOCALE = 'es-CO';
export const DEFAULT_DISPLAY_DATE_FORMAT = 'dd MMM yyyy, HH:mm';
export const GMT_MINUS_5_TIMEZONE = 'America/Bogota';

const UTC_GUARD_REGEX = /[zZ]|[+-]\d{2}:?\d{2}$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T\s]/;

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

export function parseUtcDate(dateValue: DateInput): Date | null {
  /**
   * Normaliza un valor de fecha (string, número o Date) a una instancia de `Date`.
   * Devuelve `null` si el valor no es convertible.
   */
  return toDate(dateValue);
}

/**
 * Convierte una fecha proporcionada por el backend (en UTC) al huso horario GMT-5.
 * Retorna la fecha ya formateada para mostrarla en la interfaz.
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
 * Formatea una fecha al formato de visualización estándar de SGIVU (GMT-5).
 *
 * @param dateValue - Fecha proveniente del backend (UTC o ISO).
 * @param format - Formato opcional; por defecto usa `dd MMM yyyy, HH:mm`.
 * @param locale - Locale opcional; por defecto `es-CO`.
 */
export function formatDisplayDate(
  dateValue: DateInput,
  format: string = DEFAULT_DISPLAY_DATE_FORMAT,
  locale: string = DEFAULT_LOCALE,
): string {
  return formatUtcToGmtMinus5(dateValue, format, locale);
}
