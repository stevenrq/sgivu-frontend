const COP_LOCALE = 'es-CO';
const COP_CURRENCY = 'COP';

const defaultCurrencyOptions: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: COP_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

const defaultNumberOptions: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/** Resultado de normalizar un input de dinero: valor numérico para el modelo y texto formateado para el input. */
export interface NormalizeMoneyResult {
  numericValue: number | null;
  displayValue: string;
}

function buildCurrencyFormatter(
  options?: Partial<Intl.NumberFormatOptions>,
): Intl.NumberFormat {
  return new Intl.NumberFormat(COP_LOCALE, {
    ...defaultCurrencyOptions,
    ...options,
  });
}

function buildNumberFormatter(
  options?: Partial<Intl.NumberFormatOptions>,
): Intl.NumberFormat {
  return new Intl.NumberFormat(COP_LOCALE, {
    ...defaultNumberOptions,
    ...options,
  });
}

/** Formatea un número a pesos colombianos usando `Intl.NumberFormat` con locale `es-CO`.
 *
 * @param value El valor numérico a formatear. Si es `null`, `undefined` o `NaN`, se devuelve una cadena vacía.
 * @param options Opciones adicionales para personalizar el formato (p. ej., número de decimales).
 * @returns Una cadena formateada como moneda COP, o vacía si el valor no es válido.
 */
export function formatCopCurrency(
  value: number | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return buildCurrencyFormatter(options).format(value);
}

/** Formatea un número con separadores de miles colombianos, sin símbolo de moneda.
 *
 * @param value El valor numérico a formatear. Si es `null`, `undefined` o `NaN`, se devuelve una cadena vacía.
 * @param options Opciones adicionales para personalizar el formato (p. ej., número de decimales).
 * @returns Una cadena formateada con separadores de miles, o vacía si el valor no es válido.
 */
export function formatCopNumber(
  value: number | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return buildNumberFormatter(options).format(value);
}

/**
 * Parsing inverso de moneda COP: deshace el formato es-CO eliminando puntos
 * de miles y convirtiendo comas a punto decimal.
 *
 * @param value Cadena o número a parsear como moneda COP.
 * @returns Valor numérico o `null` si el input no es parseable.
 */
export function parseCopCurrency(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const sanitized = text
    .replaceAll(/\s+/g, '')
    .replaceAll(/[^\d,.-]/g, '')
    .replaceAll('.', '')
    .replaceAll(',', '.');

  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Pensada para inputs de dinero en formularios: parsea el texto ingresado,
 * normaliza a entero positivo (o con decimales si se especifica) y re-formatea
 * para dar feedback visual inmediato al usuario.
 *
 * @param rawValue El texto ingresado por el usuario.
 * @param decimals Número de decimales permitidos (0 para enteros).
 * @returns Un objeto con el valor numérico normalizado y el texto formateado para mostrar.
 */
export function normalizeMoneyInput(
  rawValue: string,
  decimals = 0,
): NormalizeMoneyResult {
  const parsed = parseCopCurrency(rawValue);
  if (parsed === null) {
    return {
      numericValue: null,
      displayValue: rawValue ?? '',
    };
  }

  const factor = Math.pow(10, decimals);
  const normalized =
    decimals > 0
      ? Math.max(0, Math.round(parsed * factor) / factor)
      : Math.max(0, Math.round(parsed));

  return {
    numericValue: normalized,
    displayValue: formatCopNumber(normalized, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  };
}
