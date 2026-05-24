import { ParamMap, Params } from '@angular/router';
import { ListPageManager } from './list-page-manager';
import type { ActiveFilterChip } from './quick-search.utils';
export type { ActiveFilterChip } from './quick-search.utils';

/**
 * Tipos de campo soportados para la extracción/construcción de filtros desde/hacia query params.
 *
 * - 'string': texto libre
 * - 'number': valor numérico
 * - 'price': valor numérico formateado como precio (genera entradas en priceInputs)
 * - 'enum': valor de enumeración serializado como string
 * - 'boolean': valor booleano ('true'/'false' en URL, boolean en filters, string en uiState)
 */
export type FilterFieldType =
  | 'string'
  | 'number'
  | 'price'
  | 'enum'
  | 'boolean';

/**
 * Describe el mapeo entre un campo del filtro y un query param de la URL.
 */
export interface FilterFieldMapping {
  /** Clave del query param en la URL (ej: 'carBrand') */
  queryKey: string;
  /** Clave del campo en el objeto de filtros (ej: 'brand') */
  filterKey: string;
  /** Tipo de campo para decidir cómo parsear/serializar el valor */
  type: FilterFieldType;
}

/**
 * Resultado de la extracción de filtros desde los query params de la URL.
 * Separa el estado del filtro API, el estado visual del formulario
 * y los valores formateados de precios.
 */
export interface ExtractedFilters<TFilters> {
  /** Filtros con solo las claves que tienen valor (para la API), o null si no hay filtros activos */
  filters: TFilters | null;
  /** Estado completo del formulario, incluyendo campos vacíos (para binding en la UI) */
  uiState: TFilters;
  /** Valores de entrada formateados para campos de tipo 'price' */
  priceInputs: Record<string, string>;
  /** Query params reconstruidos o null si no hay filtros activos */
  queryParams: Params | null;
}

/**
 * Parsea un valor desconocido a número o null.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Extrae filtros desde un `ParamMap` de Angular usando la configuración de mapeo declarativa.
 *
 * @param queryMap - ParamMap de la ruta activa
 * @param mappings - Arreglo de mapeos campo-query param
 * @param createEmptyState - Función que retorna un objeto de filtros vacío
 * @returns Objeto con filtros API, estado UI, entradas de precio y query params reconstruidos
 */
export function extractFiltersFromQuery<TFilters>(
  queryMap: ParamMap,
  mappings: FilterFieldMapping[],
  createEmptyState: () => TFilters,
): ExtractedFilters<TFilters> {
  const uiState = createEmptyState();
  const filters = {} as Record<string, unknown>;
  const priceInputs: Record<string, string> = {};

  for (const mapping of mappings) {
    const rawValue = queryMap.get(mapping.queryKey);
    if (!rawValue) {
      if (mapping.type === 'price') {
        priceInputs[mapping.filterKey] = '';
      }
      continue;
    }

    switch (mapping.type) {
      case 'string':
      case 'enum':
        filters[mapping.filterKey] = rawValue;
        (uiState as Record<string, unknown>)[mapping.filterKey] = rawValue;
        break;
      case 'number': {
        const num = toNumber(rawValue);
        if (num !== null) {
          filters[mapping.filterKey] = num;
          (uiState as Record<string, unknown>)[mapping.filterKey] = num;
        }
        break;
      }
      case 'price': {
        const num = toNumber(rawValue);
        if (num !== null) {
          filters[mapping.filterKey] = num;
          (uiState as Record<string, unknown>)[mapping.filterKey] = num;
          priceInputs[mapping.filterKey] = String(num);
        } else {
          priceInputs[mapping.filterKey] = '';
        }
        break;
      }
      case 'boolean':
        filters[mapping.filterKey] = rawValue === 'true';
        (uiState as Record<string, unknown>)[mapping.filterKey] =
          rawValue === 'true' ? 'true' : 'false';
        break;
    }
  }

  const hasFilters = !ListPageManager.areFiltersEmpty(filters);
  const queryParams = hasFilters ? buildQueryParams(filters, mappings) : null;

  return {
    filters: hasFilters ? (filters as TFilters) : null,
    uiState,
    priceInputs,
    queryParams,
  };
}

/**
 * Construye un objeto `Params` para navegación a partir de filtros y la configuración de mapeo.
 *
 * @param filters - Objeto de filtros con valores a serializar
 * @param mappings - Arreglo de mapeos campo-query param
 * @returns Objeto Params para Angular router, o null si no hay valores
 */
export function buildQueryParams<TFilters>(
  filters: TFilters,
  mappings: FilterFieldMapping[],
): Params | null {
  const filterRecord = filters as Record<string, unknown>;
  const params: Params = {};

  for (const mapping of mappings) {
    const value = filterRecord[mapping.filterKey];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    switch (mapping.type) {
      case 'string':
        if (typeof value === 'string' && value.trim().length > 0) {
          params[mapping.queryKey] = value;
        }
        break;
      case 'enum':
        params[mapping.queryKey] = String(value);
        break;
      case 'number':
      case 'price':
        params[mapping.queryKey] = String(value);
        break;
      case 'boolean':
        params[mapping.queryKey] = String(value);
        break;
    }
  }

  return Object.keys(params).length > 0 ? params : null;
}

/**
 * Construye la lista de chips de filtros activos para mostrar en QuickSearchBarComponent.
 * Sólo incluye campos que tengan un valor activo (no vacío, no null, no undefined).
 *
 * @param filters - Objeto de filtros UI actuales
 * @param mappings - Configuración declarativa de campos
 * @param labelResolver - Función que recibe (filterKey, value) y devuelve el texto del chip,
 *   o null para excluir ese campo del listado de chips visibles.
 * @returns Lista de chips dismissibles para mostrar al usuario.
 */
export function buildActiveChips<TFilters>(
  filters: TFilters,
  mappings: FilterFieldMapping[],
  labelResolver: (filterKey: string, value: unknown) => string | null,
): ActiveFilterChip[] {
  const filterRecord = filters as Record<string, unknown>;
  const chips: ActiveFilterChip[] = [];

  for (const mapping of mappings) {
    const value = filterRecord[mapping.filterKey];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    const label = labelResolver(mapping.filterKey, value);
    if (label !== null) {
      chips.push({ filterKey: mapping.filterKey, label });
    }
  }

  return chips;
}
