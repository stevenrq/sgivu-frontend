/**
 * Representación genérica del contrato `Page<T>` de Spring Data.
 * La estructura (`sort`, `pageable`, `first/last`) refleja la serialización
 * por defecto de Spring Boot, no un diseño propio del frontend.
 */
export class PaginatedResponse<T> {
  /** Lista de elementos de la página actual. */
  content!: T[];
  /** Información de paginación y ordenamiento de la petición. */
  pageable!: Pageable;
  /** `true` si es la última página. */
  last!: boolean;
  /** Número total de páginas disponibles. */
  totalPages!: number;
  /** Número total de elementos en todas las páginas. */
  totalElements!: number;
  /** Tamaño máximo de página configurado en la petición. */
  size!: number;
  /** Índice de la página actual (base 0). */
  number!: number;
  /** Estado de ordenamiento de la página actual. */
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  /** `true` si es la primera página. */
  first!: boolean;
  /** Número de elementos en la página actual (puede ser menor que `size` en la última página). */
  numberOfElements!: number;
  /** `true` si la página no contiene elementos. */
  empty!: boolean;
}

/**
 * Metadatos de paginación y ordenamiento incluidos en cada respuesta de Spring Data.
 */
class Pageable {
  /** Índice de la página actual (base 0). */
  pageNumber!: number;
  /** Tamaño de la página configurado. */
  pageSize!: number;
  /** Estado de ordenamiento aplicado. */
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  /** Desplazamiento absoluto del primer elemento de la página. */
  offset!: number;
  /** `true` si la paginación está activa. */
  paged!: boolean;
  /** `true` si la paginación no está activa (resultado completo). */
  unpaged!: boolean;
}
