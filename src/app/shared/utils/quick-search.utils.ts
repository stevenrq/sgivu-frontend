/**
 * Tipo de entidad que originó una sugerencia de búsqueda rápida.
 * Cada feature puede ampliar este tipo con sus propios valores usando string literals.
 */
export type QuickSuggestionType = string;

/**
 * Sugerencia de autocompletado para el QuickSearchBarComponent.
 * Es intencionalmente genérica para que cualquier feature pueda usarla.
 */
export interface QuickSuggestion {
  /** Texto principal visible en la sugerencia. */
  label: string;
  /** Texto secundario con contexto adicional (p. ej. "Cliente con contratos"). */
  context: string;
  /** Categoría de la sugerencia — permite al padre saber qué filtro aplicar. */
  type: QuickSuggestionType;
  /** Valor a asignar al filtro (usualmente un ID o un código de enum). */
  value: string;
}

/**
 * Representa un filtro activo visible como chip dismissible en QuickSearchBarComponent.
 */
export interface ActiveFilterChip {
  /** Clave del campo de filtro (coincide con FilterFieldMapping.filterKey). */
  filterKey: string;
  /** Texto legible para el usuario (p. ej. "Estado: Disponible"). */
  label: string;
}
