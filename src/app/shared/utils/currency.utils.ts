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

export function formatCopCurrency(
  value: number | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return buildCurrencyFormatter(options).format(value);
}

export function formatCopNumber(
  value: number | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return buildNumberFormatter(options).format(value);
}

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
    .replace(/\s+/g, '')
    .replace(/[^\d,.\-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : null;
}

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
