import { HttpClient, HttpParams } from '@angular/common/http';
import { Signal, WritableSignal, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { PaginatedResponse } from '../models/paginated-response';

/**
 * Construye `HttpParams` a partir de un objeto de filtros,
 * ignorando valores vacíos (`undefined`, `null`, `''`) y convirtiendo los demás a string.
 *
 * @param filters - Objeto parcial de filtros a serializar como query params.
 * @returns Instancia de `HttpParams` lista para adjuntar a la petición HTTP.
 *
 * @example
 * ```ts
 * const params = buildSearchParams({ brand: 'Toyota', status: 'AVAILABLE' });
 * this.http.get('/v1/cars/search', { params });
 * ```
 */
export function buildSearchParams<TFilters>(
  filters: Partial<TFilters>,
): HttpParams {
  let params = new HttpParams();
  Object.entries(filters as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params = params.set(key, String(value));
  });
  return params;
}

/**
 * Configuración para crear un set de operaciones CRUD genéricas.
 *
 * @param T - Tipo de la entidad.
 * @param TCount - Tipo de respuesta del endpoint de conteos (raw del backend).
 * @param TCountResult - Tipo del resultado mapeado de conteos.
 */
export interface CrudConfig<T, TCount = unknown, TCountResult = unknown> {
  /** Instancia de HttpClient inyectada. */
  http: HttpClient;
  /** URL base del recurso REST (e.g., `${environment.apiUrl}/v1/cars`). */
  apiUrl: string;
  /** Función que extrae la clave `id` de una entidad. Por defecto: `(e) => (e as {id: number}).id`. */
  getId?: (entity: T) => number;
  /**
   * Mapeo de conteos: transforma la respuesta raw del endpoint `/count`
   * al formato deseado `TCountResult`.
   */
  mapCounts?: (raw: TCount) => TCountResult;
}

/**
 * Operaciones CRUD genéricas con estado basado en signals.
 */
export interface CrudOperations<T, TFilters, TCountResult = unknown> {
  /** Signal de solo lectura con la lista de entidades. */
  readonly state: Signal<T[]>;
  /** Signal de solo lectura con la última respuesta paginada. */
  readonly pagerState: Signal<PaginatedResponse<T>>;

  create(payload: T): Observable<T>;
  getAll(): Observable<T[]>;
  getAllPaginated(page: number): Observable<PaginatedResponse<T>>;
  getById(id: number): Observable<T>;
  update(id: number, payload: T): Observable<T>;
  delete(id: number): Observable<void>;
  search(filters: Partial<TFilters>): Observable<T[]>;
  searchPaginated(
    page: number,
    filters: Partial<TFilters>,
  ): Observable<PaginatedResponse<T>>;
  getCounts(): Observable<TCountResult>;

  /** Acceso directo al WritableSignal para extensiones (e.g., changeStatus). */
  _writableState: WritableSignal<T[]>;
  /** Acceso directo al WritableSignal del paginador para extensiones y testing. */
  _writablePagerState: WritableSignal<PaginatedResponse<T>>;
}

/**
 * Construye un objeto con las operaciones CRUD estándar para una entidad.
 * Los servicios concretos delegan su lógica repetitiva a esta factory
 * y conservan extensiones propias (e.g., `changeStatus`).
 *
 * @example
 * ```ts
 * private readonly crud = createCrudOperations<Car, CarSearchFilters, RawCarCountResponse>({
 *   http: this.http,
 *   apiUrl: this.apiUrl,
 *   mapCounts: (r) => ({ total: r.totalCars, active: r.availableCars, inactive: r.unavailableCars }),
 * });
 * ```
 */
export function createCrudOperations<
  T,
  TFilters,
  TCount = unknown,
  TCountResult = unknown,
>(
  config: CrudConfig<T, TCount, TCountResult>,
): CrudOperations<T, TFilters, TCountResult> {
  const { http, apiUrl } = config;
  const getId = config.getId ?? ((e: T) => (e as { id: number }).id);

  const _state: WritableSignal<T[]> = signal<T[]>([]);
  const _pagerState: WritableSignal<PaginatedResponse<T>> = signal<
    PaginatedResponse<T>
  >({} as PaginatedResponse<T>);

  return {
    state: _state.asReadonly(),
    pagerState: _pagerState.asReadonly(),
    _writableState: _state,
    _writablePagerState: _pagerState,

    create(payload: T): Observable<T> {
      return http
        .post<T>(apiUrl, payload)
        .pipe(tap((created) => _state.update((items) => [...items, created])));
    },

    getAll(): Observable<T[]> {
      return http.get<T[]>(apiUrl).pipe(tap((items) => _state.set(items)));
    },

    getAllPaginated(page: number): Observable<PaginatedResponse<T>> {
      return http
        .get<PaginatedResponse<T>>(`${apiUrl}/page/${page}`)
        .pipe(tap((pager) => _pagerState.set(pager)));
    },

    getById(id: number): Observable<T> {
      return http.get<T>(`${apiUrl}/${id}`);
    },

    update(id: number, payload: T): Observable<T> {
      return http
        .put<T>(`${apiUrl}/${id}`, payload)
        .pipe(
          tap((updated) =>
            _state.update((items) =>
              items.map((item) =>
                getId(item) === getId(updated) ? updated : item,
              ),
            ),
          ),
        );
    },

    delete(id: number): Observable<void> {
      return http
        .delete<void>(`${apiUrl}/${id}`)
        .pipe(
          tap(() =>
            _state.update((items) =>
              items.filter((item) => getId(item) !== id),
            ),
          ),
        );
    },

    search(filters: Partial<TFilters>): Observable<T[]> {
      const params = buildSearchParams(filters);
      return http.get<T[]>(`${apiUrl}/search`, { params });
    },

    searchPaginated(
      page: number,
      filters: Partial<TFilters>,
    ): Observable<PaginatedResponse<T>> {
      const params = buildSearchParams(filters);
      return http.get<PaginatedResponse<T>>(`${apiUrl}/search/page/${page}`, {
        params,
      });
    },

    getCounts(): Observable<TCountResult> {
      if (config.mapCounts) {
        return http
          .get<TCount>(`${apiUrl}/count`)
          .pipe(
            map((raw) => config.mapCounts!(raw)),
          ) as Observable<TCountResult>;
      }
      return http.get<TCountResult>(`${apiUrl}/count`);
    },
  };
}
