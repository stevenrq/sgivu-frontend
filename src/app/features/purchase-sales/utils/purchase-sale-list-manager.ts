import { computed, inject, Injectable, signal } from '@angular/core';
import { Router, Params, ParamMap } from '@angular/router';
import { ContractStatus } from '../models/contract-status.enum';
import { ContractType } from '../models/contract-type.enum';
import {
  PurchaseSaleUiFilters,
  ContractStatusFilter,
  ContractTypeFilter,
  getDefaultUiFilters,
  buildQueryParamsFromFilters,
  extractFiltersFromQuery,
  paramMapToObject,
  buildActiveFilterChips,
  countActiveAdvancedFilters,
} from './purchase-sale-filter.utils';
import { PurchaseSaleSearchFilters } from '../services/purchase-sale.service';
import { PurchaseSale } from '../models/purchase-sale.model';
import { PurchaseSaleLookupService } from '../services/purchase-sale-lookup.service';
import {
  QuickSuggestion,
  buildQuickSuggestions,
  hintQuickSearchFilters,
} from './quick-search.utils';
import { ActiveFilterChip } from '../../../shared/utils/quick-search.utils';

export interface ParsedQuery {
  requestFilters: PurchaseSaleSearchFilters | null;
  queryParams: Params | null;
}

/**
 * Encapsula el estado de filtros, búsqueda rápida y entidades enlazadas del
 * listado de compraventas, siguiendo el mismo patrón que ListPageManager.
 *
 * Se provee en el componente (no en root) para que cada instancia del listado
 * tenga su propio estado aislado.
 */
@Injectable()
export class PurchaseSaleListManager {
  private readonly router = inject(Router);
  private readonly lookupService = inject(PurchaseSaleLookupService);

  private readonly _filters = signal<PurchaseSaleUiFilters>(
    getDefaultUiFilters(),
  );
  private readonly _quickSuggestions = signal<QuickSuggestion[]>([]);
  private readonly _pagerQueryParams = signal<Params | null>(null);

  readonly filters = this._filters.asReadonly();
  readonly quickSuggestions = this._quickSuggestions.asReadonly();
  readonly pagerQueryParams = this._pagerQueryParams.asReadonly();

  readonly linkedClientIds = new Set<number>();
  readonly linkedUserIds = new Set<number>();
  readonly linkedVehicleIds = new Set<number>();

  readonly activeChips = computed<ActiveFilterChip[]>(() =>
    buildActiveFilterChips(this._filters(), {
      clientMap: this.lookupService.clientMap(),
      userMap: this.lookupService.userMap(),
      vehicleMap: this.lookupService.allVehicleMap(),
    }),
  );

  readonly advancedFiltersCount = computed(() =>
    countActiveAdvancedFilters(this._filters()),
  );

  /** Parsea los query params de la URL, actualiza signals internos y devuelve los filtros de API. */
  parseQuery(query: ParamMap): ParsedQuery {
    const result = extractFiltersFromQuery(query);
    this._filters.set(result.uiFilters);
    this._pagerQueryParams.set(result.queryParams);
    return result;
  }

  /** Navega a la página indicada preservando (opcionalmente) los query params. */
  navigateToPage(page: number, queryParams?: Params): void {
    void this.router.navigate(['/purchase-sales/page', page], { queryParams });
  }

  /** Navega a la primera página cuando la URL contiene un número de página inválido. */
  navigateToFirstPagePreservingQuery(query: ParamMap): void {
    this.navigateToPage(0, paramMapToObject(query) ?? undefined);
  }

  applyFilters(): void {
    this._quickSuggestions.set([]);
    hintQuickSearchFilters(this._filters(), this.buildSearchContext());
    if (
      this._filters().term &&
      (this._filters().clientId ||
        this._filters().userId ||
        this._filters().vehicleId)
    ) {
      this._filters.update((f) => ({ ...f, term: '' }));
    }
    const queryParams = buildQueryParamsFromFilters(this._filters());
    void this.router.navigate(['/purchase-sales/page', 0], { queryParams });
  }

  clearFilters(): void {
    this._filters.set(getDefaultUiFilters());
    this._quickSuggestions.set([]);
    void this.router.navigate(['/purchase-sales/page', 0]);
  }

  patchFilters(patch: Partial<PurchaseSaleUiFilters>): void {
    this._filters.update((f) => ({ ...f, ...patch }));
  }

  removeFilter(filterKey: string): void {
    const defaults = getDefaultUiFilters() as unknown as Record<
      string,
      unknown
    >;
    this._filters.update(
      (f) => ({ ...f, [filterKey]: defaults[filterKey] ?? '' }) as typeof f,
    );
    if (
      filterKey === 'clientId' ||
      filterKey === 'userId' ||
      filterKey === 'vehicleId'
    ) {
      this._filters.update((f) => ({ ...f, term: '' }));
    }
    this.applyFilters();
  }

  onSearchValueChange(value: string): void {
    this._filters.update((f) => ({ ...f, term: value }));
    this._quickSuggestions.set(
      value ? buildQuickSuggestions(value, this.buildSearchContext()) : [],
    );
  }

  clearSearchTerm(): void {
    this._filters.update((f) => ({ ...f, term: '' }));
    this._quickSuggestions.set([]);
    this.applyFilters();
  }

  selectQuickSuggestion(suggestion: QuickSuggestion): void {
    const f = this._filters();
    if (suggestion.type === 'client') {
      this._filters.set({ ...f, clientId: suggestion.value, term: '' });
    } else if (suggestion.type === 'user') {
      this._filters.set({ ...f, userId: suggestion.value, term: '' });
    } else if (suggestion.type === 'vehicle') {
      this._filters.set({ ...f, vehicleId: suggestion.value, term: '' });
    } else if (suggestion.type === 'status') {
      this._filters.set({
        ...f,
        contractStatus: suggestion.value as ContractStatusFilter,
        term: '',
      });
    } else if (suggestion.type === 'type') {
      this._filters.set({
        ...f,
        contractType: suggestion.value as ContractTypeFilter,
        term: '',
      });
    }
    this._quickSuggestions.set([]);
    this.applyFilters();
  }

  updateLinkedEntities(contracts: PurchaseSale[]): void {
    this.linkedClientIds.clear();
    this.linkedUserIds.clear();
    this.linkedVehicleIds.clear();
    for (const c of contracts) {
      this.trackLinkedId(this.linkedClientIds, c.clientId);
      this.trackLinkedId(this.linkedUserIds, c.userId);
      this.trackLinkedId(this.linkedVehicleIds, c.vehicleId);
    }
  }

  private buildSearchContext() {
    return {
      clients: this.lookupService.clients(),
      users: this.lookupService.users(),
      vehicles: this.lookupService.allVehicles(),
      linkedClientIds: this.linkedClientIds,
      linkedUserIds: this.linkedUserIds,
      linkedVehicleIds: this.linkedVehicleIds,
      contractStatuses: Object.values(ContractStatus),
      contractTypes: Object.values(ContractType),
    };
  }

  private trackLinkedId(
    target: Set<number>,
    value: number | null | undefined,
  ): void {
    if (typeof value === 'number' && Number.isFinite(value)) {
      target.add(value);
    }
  }
}
