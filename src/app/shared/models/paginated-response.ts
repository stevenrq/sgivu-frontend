/**
 * Represents a paginated response from a server.
 *
 * @template T - The type of items in the paginated response.
 */
export class PaginatedResponse<T> {
  content!: T[];
  pageable!: Pageable;
  last!: boolean;
  totalPages!: number;
  totalElements!: number;
  size!: number;
  number!: number;
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first!: boolean;
  numberOfElements!: number;
  empty!: boolean;
}

class Pageable {
  pageNumber!: number;
  pageSize!: number;
  sort!: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  offset!: number;
  paged!: boolean;
  unpaged!: boolean;
}
