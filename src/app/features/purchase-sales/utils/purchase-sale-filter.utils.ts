import { ParamMap, Params } from '@angular/router';
import { ContractStatus } from '../models/contract-status.enum';
import { ContractType } from '../models/contract-type.enum';
import { PaymentMethod } from '../models/payment-method.enum';
import { PurchaseSaleSearchFilters } from '../services/purchase-sale.service';
import {
  normalizeMoneyInput,
  parseCopCurrency,
} from '../../../shared/utils/currency.utils';
import { ChipOption } from '../../../shared/components/filter-chip-group/filter-chip-group.component';
import { ActiveFilterChip } from '../../../shared/utils/quick-search.utils';
import {
  getContractTypeLabel,
  getPaymentMethodLabel,
  getStatusLabel,
} from '../models/contract-labels';
import {
  ClientOption,
  UserOption,
  VehicleOption,
} from '../models/purchase-sale-reference.model';

export type ContractTypeFilter = ContractType | 'ALL';
export type ContractStatusFilter = ContractStatus | 'ALL';
export type PriceFilterKey =
  | 'minPurchasePrice'
  | 'maxPurchasePrice'
  | 'minSalePrice'
  | 'maxSalePrice';

/**
 * Modelo de filtros de UI para la lista de contratos.
 * Los strings vacíos representan "sin filtro"; `'ALL'` en enums indica "todos".
 * Este modelo se serializa a query params para que los filtros sean compartibles
 * y sobrevivan a recarga de página.
 */
export interface PurchaseSaleUiFilters {
  contractType: ContractTypeFilter;
  contractStatus: ContractStatusFilter;
  clientId: string;
  userId: string;
  vehicleId: string;
  paymentMethod: string;
  term: string;
  minPurchasePrice: string;
  maxPurchasePrice: string;
  minSalePrice: string;
  maxSalePrice: string;
}

const PRICE_DECIMALS = 0;
const CONTRACT_TYPES = Object.values(ContractType);
const CONTRACT_STATUSES = Object.values(ContractStatus);

export function getDefaultUiFilters(): PurchaseSaleUiFilters {
  return {
    contractType: 'ALL',
    contractStatus: 'ALL',
    clientId: '',
    userId: '',
    vehicleId: '',
    paymentMethod: '',
    term: '',
    minPurchasePrice: '',
    maxPurchasePrice: '',
    minSalePrice: '',
    maxSalePrice: '',
  };
}

export function normalizePriceInput(rawValue: string): string {
  const { displayValue } = normalizeMoneyInput(rawValue, PRICE_DECIMALS);
  return displayValue;
}

/** Serializa los filtros de UI a query params para la URL, omitiendo valores por defecto.
 *
 * @param filters Filtros de UI a serializar.
 * @returns Objeto de query params o `undefined` si no hay filtros activos.
 */
export function buildQueryParamsFromFilters(
  filters: PurchaseSaleUiFilters,
): Params | undefined {
  const params: Params = {};

  if (filters.contractType !== 'ALL') {
    params['contractType'] = filters.contractType;
  }

  if (filters.contractStatus !== 'ALL') {
    params['contractStatus'] = filters.contractStatus;
  }

  if (filters.paymentMethod) {
    params['paymentMethod'] = filters.paymentMethod;
  }

  for (const [key, value] of [
    ['clientId', filters.clientId],
    ['userId', filters.userId],
    ['vehicleId', filters.vehicleId],
    ['term', filters.term],
  ] as const) {
    if (value) {
      params[key] = value;
    }
  }

  const priceKeys: PriceFilterKey[] = [
    'minPurchasePrice',
    'maxPurchasePrice',
    'minSalePrice',
    'maxSalePrice',
  ];

  for (const key of priceKeys) {
    const parsed = parsePriceFilter(filters[key]);
    if (parsed !== null) {
      params[key] = parsed;
    }
  }

  return Object.keys(params).length ? params : undefined;
}

/**
 * Deserializa query params de la URL a filtros de UI y filtros de request.
 * Valida enum values para ignorar parámetros con valores inválidos (ej: manipulación manual de URL).
 * Los precios se re-formatean con `normalizeMoneyInput` para mostrar el formato COP en el input.
 *
 * @param query Query params de la URL a deserializar.
 * @returns Filtros de UI (para el formulario), filtros de request (para la API) y query params limpios.
 */
export function extractFiltersFromQuery(query: ParamMap): {
  uiFilters: PurchaseSaleUiFilters;
  requestFilters: PurchaseSaleSearchFilters | null;
  queryParams: Params | null;
} {
  const uiFilters = getDefaultUiFilters();
  const requestFilters: PurchaseSaleSearchFilters = {};

  const applyEnum = <T extends string>(
    key: keyof PurchaseSaleUiFilters & keyof PurchaseSaleSearchFilters,
    isValid: (v: string | null) => v is T,
  ): void => {
    const val = query.get(key);
    if (isValid(val)) {
      (uiFilters[key] as string) = val;
      (requestFilters[key] as string) = val;
    }
  };

  const applyNumber = (
    uiKey: keyof PurchaseSaleUiFilters,
    requestKey: keyof PurchaseSaleSearchFilters,
  ): void => {
    const val = query.get(uiKey);
    if (!val) return;
    (uiFilters[uiKey] as string) = val;
    const parsed = parseNumberParam(val);
    if (parsed !== undefined) {
      (requestFilters[requestKey] as number) = parsed;
    }
  };

  const applyPrice = (
    uiKey: keyof PurchaseSaleUiFilters,
    requestKey: keyof PurchaseSaleSearchFilters,
  ): void => {
    const val = query.get(uiKey);
    if (!val) return;
    const { numericValue, displayValue } = normalizeMoneyInput(
      val,
      PRICE_DECIMALS,
    );
    (uiFilters[uiKey] as string) = displayValue;
    if (numericValue !== null) {
      (requestFilters[requestKey] as number) = numericValue;
    }
  };

  const applyString = (
    key: keyof PurchaseSaleUiFilters & keyof PurchaseSaleSearchFilters,
  ): void => {
    const val = query.get(key);
    if (!val) return;
    (uiFilters[key] as string) = val;
    (requestFilters[key] as string) = val;
  };

  applyEnum('contractType', isValidContractType);
  applyEnum('contractStatus', isValidContractStatus);
  applyEnum('paymentMethod', isValidPaymentMethod);

  applyNumber('clientId', 'clientId');
  applyNumber('userId', 'userId');
  applyNumber('vehicleId', 'vehicleId');

  applyPrice('minPurchasePrice', 'minPurchasePrice');
  applyPrice('maxPurchasePrice', 'maxPurchasePrice');
  applyPrice('minSalePrice', 'minSalePrice');
  applyPrice('maxSalePrice', 'maxSalePrice');

  applyString('term');

  const queryParams = paramMapToObject(query);
  const hasFilters = !arePurchaseSaleFiltersEmpty(requestFilters);

  return {
    uiFilters,
    requestFilters: hasFilters ? requestFilters : null,
    queryParams,
  };
}

export function paramMapToObject(map: ParamMap): Params | null {
  const params: Params = {};
  map.keys.forEach((key) => {
    const value = map.get(key);
    if (value) {
      params[key] = value;
    }
  });
  return Object.keys(params).length ? params : null;
}

export function arePurchaseSaleFiltersEmpty(
  filters: PurchaseSaleSearchFilters,
): boolean {
  return Object.values(filters).every(
    (value) => value === undefined || value === null,
  );
}

function parsePriceFilter(value: string): number | null {
  const parsed = parseCopCurrency(value);
  if (parsed === null) {
    return null;
  }
  const normalized =
    PRICE_DECIMALS > 0
      ? Math.round(parsed * Math.pow(10, PRICE_DECIMALS)) /
        Math.pow(10, PRICE_DECIMALS)
      : Math.round(parsed);
  const sanitized = Math.max(0, normalized);
  return Number.isFinite(sanitized) ? sanitized : null;
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isValidContractType(value: string | null): value is ContractType {
  return !!value && CONTRACT_TYPES.includes(value as ContractType);
}

function isValidContractStatus(value: string | null): value is ContractStatus {
  return !!value && CONTRACT_STATUSES.includes(value as ContractStatus);
}

function isValidPaymentMethod(value: string | null): value is PaymentMethod {
  return (
    !!value && Object.values(PaymentMethod).includes(value as PaymentMethod)
  );
}

/** Opciones de chips para el filtro de tipo de contrato. */
export const CONTRACT_TYPE_CHIP_OPTIONS: ChipOption[] = Object.values(
  ContractType,
).map((type) => ({ value: type, label: getContractTypeLabel(type) }));

/** Opciones de chips para el filtro de estado de contrato. */
export const CONTRACT_STATUS_CHIP_OPTIONS: ChipOption[] = Object.values(
  ContractStatus,
).map((status) => ({ value: status, label: getStatusLabel(status) }));

/** Opciones de chips para el filtro de método de pago. */
export const PAYMENT_METHOD_CHIP_OPTIONS: ChipOption[] = Object.values(
  PaymentMethod,
).map((method) => ({ value: method, label: getPaymentMethodLabel(method) }));

/** Mapas de lookup necesarios para etiquetar los chips de filtros activos. */
export interface ActiveChipLookups {
  clientMap: ReadonlyMap<number, ClientOption>;
  userMap: ReadonlyMap<number, UserOption>;
  vehicleMap: ReadonlyMap<number, VehicleOption>;
}

/** Construye los chips de filtros activos mostrados bajo la búsqueda rápida. */
export function buildActiveFilterChips(
  f: PurchaseSaleUiFilters,
  lookups: ActiveChipLookups,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (f.contractType && f.contractType !== 'ALL') {
    chips.push({
      filterKey: 'contractType',
      label: `Tipo: ${getContractTypeLabel(f.contractType as ContractType)}`,
    });
  }
  if (f.contractStatus && f.contractStatus !== 'ALL') {
    chips.push({
      filterKey: 'contractStatus',
      label: `Estado: ${getStatusLabel(f.contractStatus as ContractStatus)}`,
    });
  }
  if (f.paymentMethod) {
    chips.push({
      filterKey: 'paymentMethod',
      label: `Pago: ${getPaymentMethodLabel(f.paymentMethod as PaymentMethod)}`,
    });
  }
  if (f.clientId) {
    const client = lookups.clientMap.get(Number(f.clientId));
    chips.push({
      filterKey: 'clientId',
      label: `Cliente: ${client?.label ?? f.clientId}`,
    });
  }
  if (f.userId) {
    const user = lookups.userMap.get(Number(f.userId));
    chips.push({
      filterKey: 'userId',
      label: `Usuario: ${user?.label ?? f.userId}`,
    });
  }
  if (f.vehicleId) {
    const vehicle = lookups.vehicleMap.get(Number(f.vehicleId));
    const vehicleDisplay = vehicle?.plate ?? vehicle?.label ?? f.vehicleId;
    chips.push({
      filterKey: 'vehicleId',
      label: `Vehículo: ${vehicleDisplay}`,
    });
  }
  if (f.minPurchasePrice)
    chips.push({
      filterKey: 'minPurchasePrice',
      label: `Compra ≥ $${f.minPurchasePrice}`,
    });
  if (f.maxPurchasePrice)
    chips.push({
      filterKey: 'maxPurchasePrice',
      label: `Compra ≤ $${f.maxPurchasePrice}`,
    });
  if (f.minSalePrice)
    chips.push({
      filterKey: 'minSalePrice',
      label: `Venta ≥ $${f.minSalePrice}`,
    });
  if (f.maxSalePrice)
    chips.push({
      filterKey: 'maxSalePrice',
      label: `Venta ≤ $${f.maxSalePrice}`,
    });
  return chips;
}

/** Cuenta los filtros avanzados activos (badge del botón "Más filtros"). */
export function countActiveAdvancedFilters(f: PurchaseSaleUiFilters): number {
  return [
    f.contractType !== 'ALL' ? f.contractType : null,
    f.contractStatus !== 'ALL' ? f.contractStatus : null,
    f.paymentMethod,
    f.clientId,
    f.userId,
    f.vehicleId,
    f.minPurchasePrice,
    f.maxPurchasePrice,
    f.minSalePrice,
    f.maxSalePrice,
  ].filter((v) => v !== null && v !== undefined && v !== '').length;
}
