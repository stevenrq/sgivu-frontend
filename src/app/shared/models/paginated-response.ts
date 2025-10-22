/**
 * Representa una respuesta paginada desde el servidor.
 * Este objeto encapsula una colección de elementos junto con metadatos
 * de paginación, como el número total de páginas, el total de elementos
 * y la información de la página actual.
 *
 * @template T - El tipo de dato de los elementos contenidos en la respuesta.
 */
export class PaginatedResponse<T> {
  /**
   * La lista de elementos de la página actual.
   */
  content!: T[];
  /**
   * Los metadatos de la paginación.
   */
  pageable!: Pageable;
  /**
   * Indica si la página actual es la última.
   */
  last!: boolean;
  /**
   * El número total de páginas disponibles.
   */
  totalPages!: number;
  /**
   * El número total de elementos en todas las páginas.
   */
  totalElements!: number;
  /**
   * El tamaño de la página (la cantidad máxima de elementos por página).
   */
  size!: number;
  /**
   * El número de la página actual (basado en cero).
   */
  number!: number;
  /**
   * Los metadatos de la ordenación de los elementos.
   */
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  /**
   * Indica si la página actual es la primera.
   */
  first!: boolean;
  /**
   * El número de elementos en la página actual.
   */
  numberOfElements!: number;
  /**
   * Indica si el contenido de la página está vacío.
   */
  empty!: boolean;
}

/**
 * Representa los metadatos de una solicitud o respuesta de paginación.
 * Contiene información sobre la página solicitada, el tamaño y la ordenación.
 */
class Pageable {
  /**
   * El número de la página solicitada (basado en cero).
   */
  pageNumber!: number;
  /**
   * El tamaño de la página.
   */
  pageSize!: number;
  /**
   * Los metadatos de la ordenación aplicada.
   */
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  /**
   * El desplazamiento (offset) en el conjunto de resultados.
   */
  offset!: number;
  /**
   * Indica si la paginación está activada.
   */
  paged!: boolean;
  /**
   * Indica si la paginación no está activada.
   */
  unpaged!: boolean;
}
