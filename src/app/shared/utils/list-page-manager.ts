import { DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, finalize } from 'rxjs';
import { PaginatedResponse } from '../models/paginated-response';

/**
 * Estado de una lista paginada con conteos KPI.
 */
export interface ListPageState<T> {
  readonly items: T[];
  readonly pager: PaginatedResponse<T> | undefined;
  readonly active: number;
  readonly inactive: number;
  readonly total: number;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Configuración para cargar una página de entidades.
 */
export interface LoadPageConfig<T> {
  fetchPager: (page: number) => Observable<PaginatedResponse<T>>;
  fetchCounts: () => Observable<unknown>;
  errorMessage: string;
  countKeys: { active: string[]; inactive: string[] };
  computeCountsFn: (items: T[]) => { active: number; inactive: number };
  fallbackCounts?: () => Observable<FallbackCountsResult<T>>;
}

export interface FallbackCountsResult<T> {
  active: number;
  inactive: number;
  total: number;
  items?: T[];
}

/**
 * Clase reutilizable que encapsula la infraestructura de paginación,
 * conteos KPI, fallback a dataset completo y gestión del ciclo de vida.
 *
 * Cada componente de listado crea su propia instancia:
 * ```ts
 * listManager = new ListPageManager<Person>(inject(DestroyRef));
 * ```
 */
export class ListPageManager<T> {
  private readonly _items = signal<T[]>([]);
  private readonly _pager = signal<PaginatedResponse<T> | undefined>(undefined);
  private readonly _active = signal(0);
  private readonly _inactive = signal(0);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _currentPage = signal(0);

  readonly items = this._items.asReadonly();
  readonly pager = this._pager.asReadonly();
  readonly active = this._active.asReadonly();
  readonly inactive = this._inactive.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();

  readonly state = computed<ListPageState<T>>(() => ({
    items: this._items(),
    pager: this._pager(),
    active: this._active(),
    inactive: this._inactive(),
    total: this._total(),
    loading: this._loading(),
    error: this._error(),
  }));

  constructor(private readonly destroyRef: DestroyRef) {}

  /**
   * Carga una página. Combina paginación + conteos en un solo forkJoin,
   * aplica fallback a dataset completo si los conteos del API son inconsistentes.
   *
   * @param config - Configuración para cargar la página.
   * @param page - Número de página a cargar.
   */
  loadPage(config: LoadPageConfig<T>, page: number): void {
    this._loading.set(true);
    this._error.set(null);

    forkJoin({
      pager: config.fetchPager(page),
      counts: config.fetchCounts(),
    })
      .pipe(
        finalize(() => this._loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ pager, counts }) => {
          const items = pager.content ?? [];
          const pageCounts = config.computeCountsFn(items);
          this._items.set(items);
          this._pager.set(pager);

          const {
            active: apiActive,
            inactive: apiInactive,
            hasCounts,
          } = ListPageManager.extractCounts(counts, config.countKeys);

          let activeCount = apiActive;
          let inactiveCount = apiInactive;

          if (!hasCounts) {
            ({ active: activeCount, inactive: inactiveCount } = pageCounts);

            if (
              ListPageManager.isFiniteNum(pager.totalElements) &&
              (items.length > 0 ||
                ListPageManager.isFiniteNum(pager.numberOfElements))
            ) {
              const totalElements = Number(pager.totalElements);
              if (inactiveCount === 0 && activeCount <= totalElements) {
                inactiveCount = Math.max(totalElements - activeCount, 0);
              }
            }
          }

          const fallbackNeeded =
            !!config.fallbackCounts &&
            ListPageManager.shouldFallback({
              hasCounts,
              expectedActive: activeCount,
              expectedInactive: inactiveCount,
              pageCounts,
              reportedTotal: pager.totalElements,
            });

          this._active.set(activeCount);
          this._inactive.set(inactiveCount);
          this._total.set(
            ListPageManager.resolveTotal(
              pager.totalElements,
              activeCount,
              inactiveCount,
              items.length,
            ),
          );
          this._currentPage.set(pager.number ?? page ?? 0);

          if (fallbackNeeded && config.fallbackCounts) {
            config
              .fallbackCounts()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(
                ({ active, inactive, total, items: fallbackItems }) => {
                  this._active.set(active);
                  this._inactive.set(inactive);
                  this._total.set(total);

                  if (fallbackItems) {
                    const pageIndex = pager.number ?? page ?? 0;
                    const pageSize = ListPageManager.resolvePageSize(
                      pager,
                      fallbackItems.length,
                    );
                    const pageItems = ListPageManager.sliceItems(
                      fallbackItems,
                      pageIndex,
                      pageSize,
                    );

                    this._items.set(pageItems);
                    this._pager.set(
                      ListPageManager.mergePagerWithFallback(
                        pager,
                        pageItems,
                        total,
                        pageSize,
                        pageIndex,
                      ),
                    );
                  }
                },
              );
          }
        },
        error: (err) => {
          console.error(err);
          this._error.set(config.errorMessage);
          this._items.set([]);
          this._pager.set(undefined);
        },
      });
  }

  /**
   * Convierte el query param `page` de la URL a un índice de página numérico.
   * Retorna `0` si el valor está ausente y `-1` si no es un número válido.
   *
   * @param pageParam - Valor del query param `page` (puede ser `null`).
   * @returns Índice de página numérico, `0` si es null o `-1` si es inválido.
   */
  static parsePage(pageParam: string | null): number {
    if (!pageParam) {
      return 0;
    }
    const parsed = Number(pageParam);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  /**
   * Determina si un objeto de filtros está completamente vacío
   * (todas las propiedades son `undefined`, `null` o cadenas en blanco).
   *
   * @param filters - Objeto de filtros a evaluar.
   * @returns `true` si todos los valores son vacíos, `false` en caso contrario.
   */
  static areFiltersEmpty(filters: Record<string, unknown>): boolean {
    return Object.values(filters).every((value) => {
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      return false;
    });
  }

  /**
   * Recorta espacios de un string de filtro y retorna `undefined` si queda vacío.
   * Útil para normalizar valores antes de enviarlos a la API.
   *
   * @param value - Valor del filtro a normalizar.
   * @returns El string recortado, o `undefined` si está vacío.
   */
  static normalizeFilterValue(
    value: string | undefined | null,
  ): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  /**
   * Convierte un valor de estado string/boolean a `boolean | undefined`.
   * Las cadenas vacías y `undefined` se convierten en `undefined` (sin filtro).
   *
   * @param value - Valor del filtro de estado en distintos formatos.
   * @returns `true` si está activo, `false` si inactivo, `undefined` si no hay filtro.
   */
  static normalizeStatus(
    value: boolean | '' | 'true' | 'false' | undefined,
  ): boolean | undefined {
    if (value === '' || value === undefined) {
      return undefined;
    }
    return value === true || value === 'true';
  }

  /**
   * Calcula los conteos de elementos activos e inactivos a partir de su campo `enabled`.
   *
   * @param items - Lista de entidades con la propiedad `enabled`.
   * @returns Objeto con la cantidad de elementos activos e inactivos.
   */
  static computeEnabledCounts<U extends { enabled: boolean }>(
    items: U[],
  ): { active: number; inactive: number } {
    const active = items.filter((item) => item.enabled).length;
    return { active, inactive: items.length - active };
  }

  private static extractCounts(
    counts: unknown,
    keys: { active: string[]; inactive: string[] },
  ): { active: number; inactive: number; hasCounts: boolean } {
    if (!counts || typeof counts !== 'object') {
      return { active: 0, inactive: 0, hasCounts: false };
    }

    const source = counts as Record<string, unknown>;
    const { value: activeValue, found: activeFound } =
      ListPageManager.pickFirst(source, keys.active);
    const { value: inactiveValue, found: inactiveFound } =
      ListPageManager.pickFirst(source, keys.inactive);

    return {
      active: ListPageManager.normalizeCount(activeValue),
      inactive: ListPageManager.normalizeCount(inactiveValue),
      hasCounts: activeFound || inactiveFound,
    };
  }

  private static pickFirst(
    source: Record<string, unknown>,
    keys: string[],
  ): { value: unknown; found: boolean } {
    for (const key of keys) {
      if (key in source) {
        return { value: source[key], found: true };
      }
    }
    return { value: undefined, found: false };
  }

  private static normalizeCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private static resolveTotal(
    totalElements: number | undefined,
    active: number,
    inactive: number,
    fallbackLength: number,
  ): number {
    const parsedTotal = Number(totalElements);
    if (Number.isFinite(parsedTotal)) {
      return parsedTotal;
    }
    const sum = active + inactive;
    return Number.isFinite(sum) ? sum : fallbackLength;
  }

  private static isFiniteNum(
    value: number | undefined | null,
  ): value is number {
    return Number.isFinite(Number(value));
  }

  private static shouldFallback(context: {
    hasCounts: boolean;
    expectedActive: number;
    expectedInactive: number;
    pageCounts: { active: number; inactive: number };
    reportedTotal: number | undefined;
  }): boolean {
    if (!context.hasCounts) {
      return true;
    }

    const expectedTotal =
      Math.max(context.expectedActive, 0) +
      Math.max(context.expectedInactive, 0);
    const reportedTotal = Number(context.reportedTotal);
    const hasReportedTotal = Number.isFinite(reportedTotal);

    if (
      expectedTotal > 0 &&
      (!hasReportedTotal || reportedTotal < expectedTotal)
    ) {
      return true;
    }

    if (context.expectedInactive > 0 && context.pageCounts.inactive === 0) {
      return true;
    }

    return false;
  }

  private static resolvePageSize<U>(
    pager: PaginatedResponse<U>,
    fallbackTotal: number,
  ): number {
    const parsedSize = Number(pager?.size);
    if (Number.isFinite(parsedSize) && parsedSize > 0) {
      return parsedSize;
    }
    const parsedNumberOfElements = Number(pager?.numberOfElements);
    if (Number.isFinite(parsedNumberOfElements) && parsedNumberOfElements > 0) {
      return parsedNumberOfElements;
    }
    return fallbackTotal > 0 ? fallbackTotal : 10;
  }

  private static sliceItems<U>(
    items: U[],
    pageIndex: number,
    pageSize: number,
  ): U[] {
    if (pageSize <= 0) {
      return [...items];
    }
    const start = pageIndex * pageSize;
    return items.slice(start, start + pageSize);
  }

  private static mergePagerWithFallback<U>(
    pager: PaginatedResponse<U>,
    pageItems: U[],
    totalElements: number,
    pageSize: number,
    pageIndex: number,
  ): PaginatedResponse<U> {
    const totalPages =
      pageSize <= 0
        ? totalElements > 0
          ? 1
          : 0
        : Math.max(Math.ceil(totalElements / pageSize), 1);

    return {
      ...pager,
      content: pageItems,
      totalElements,
      totalPages,
      numberOfElements: pageItems.length,
      size: pageSize,
      number: pageIndex,
      empty: pageItems.length === 0,
      first: pageIndex === 0,
      last: pageIndex >= totalPages - 1,
    };
  }
}
