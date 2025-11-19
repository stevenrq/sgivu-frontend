import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  combineLatest,
  finalize,
  forkJoin,
  map,
  of,
  Subscription,
  switchMap,
  Observable,
} from 'rxjs';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import { CarService, CarSearchFilters } from '../../services/car.service';
import {
  MotorcycleService,
  MotorcycleSearchFilters,
} from '../../services/motorcycle.service';
import { VehicleCount } from '../../interfaces/vehicle-count.interface';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { VehicleUiHelperService } from '../../../../shared/services/vehicle-ui-helper.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { normalizeMoneyInput } from '../../../../shared/utils/currency.utils';

type VehicleTab = 'car' | 'motorcycle';
type VehicleEntity = Car | Motorcycle;

interface VehicleListState<T extends VehicleEntity> {
  items: T[];
  pager?: PaginatedResponse<T>;
  total: number;
  available: number;
  unavailable: number;
  loading: boolean;
  error: string | null;
}

interface VehicleLoadConfig<T extends VehicleEntity> {
  page: number;
  state: VehicleListState<T>;
  type: VehicleTab;
  fetchPager: (page: number) => Observable<PaginatedResponse<T>>;
  fetchCounts: () => Observable<VehicleCount>;
  onPageResolved: (page: number) => void;
  errorMessage: string;
  fallbackCounts?: () => Observable<VehicleFallbackResult<T>>;
}

interface VehicleFallbackResult<T extends VehicleEntity> {
  available: number;
  unavailable: number;
  total: number;
  items: T[];
}

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    PagerComponent,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
    CopCurrencyPipe,
  ],
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.css',
})
export class VehicleListComponent implements OnInit, OnDestroy {
  activeTab: VehicleTab = 'car';
  carFilters: CarSearchFilters = this.createCarFilterState();
  motorcycleFilters: MotorcycleSearchFilters = this.createMotorcycleFilterState();
  carPriceInputs: Record<'minSalePrice' | 'maxSalePrice', string> = {
    minSalePrice: '',
    maxSalePrice: '',
  };
  motorcyclePriceInputs: Record<'minSalePrice' | 'maxSalePrice', string> = {
    minSalePrice: '',
    maxSalePrice: '',
  };

  readonly vehicleStatuses = Object.values(VehicleStatus);
  readonly VehicleStatus = VehicleStatus;

  readonly carState = this.createInitialState<Car>();
  readonly motorcycleState = this.createInitialState<Motorcycle>();

  private currentCarPage = 0;
  private currentMotorcyclePage = 0;
  private readonly subscriptions: Subscription[] = [];
  private readonly priceDecimals = 0;

  constructor(
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly vehicleUiHelper: VehicleUiHelperService,
  ) {}

  ngOnInit(): void {
    const sub = combineLatest([this.route.paramMap, this.route.data])
      .pipe(
        switchMap(([params, data]) => {
          const requestedTab = this.normalizeTab(data['vehicleType']);
          const tabChanged = this.activeTab !== requestedTab;
          this.activeTab = requestedTab;

          const pageParam = params.get('page');
          const page = this.parsePage(pageParam);
          if (Number.isNaN(page) || page < 0) {
            this.navigateToPage(0, this.activeTab);
            return of(null);
          }

          if (tabChanged) {
            this.resetSearchFilters(requestedTab);
          }

          return of({ page });
        }),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        if (this.activeTab === 'car') {
          this.loadCars(result.page);
        } else {
          this.loadMotorcycles(result.page);
        }
      });

    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  get activeState(): VehicleListState<VehicleEntity> {
    return this.activeTab === 'car'
      ? (this.carState as VehicleListState<VehicleEntity>)
      : (this.motorcycleState as VehicleListState<VehicleEntity>);
  }

  get pagerUrl(): string {
    return this.activeTab === 'car'
      ? '/vehicles/cars/page'
      : '/vehicles/motorcycles/page';
  }

  startPurchaseFlow(): void {
    const vehicleKind = this.activeTab === 'car' ? 'CAR' : 'MOTORCYCLE';
    void this.router.navigate(['/purchase-sales/register'], {
      queryParams: {
        contractType: 'PURCHASE',
        vehicleKind,
      },
    });
  }

  get createLabel(): string {
    return this.activeTab === 'car'
      ? 'Registrar automóvil'
      : 'Registrar motocicleta';
  }

  get totalCount(): number {
    return this.activeState.total;
  }

  get availableCount(): number {
    return this.activeState.available;
  }

  get unavailableCount(): number {
    return this.activeState.unavailable;
  }

  switchTab(tab: VehicleTab): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.navigateToPage(this.getCurrentPage(tab), tab);
  }

  onCarSearch(): void {
    this.syncPriceFilters('car');
    this.performSearch('car');
  }

  onMotorcycleSearch(): void {
    this.syncPriceFilters('motorcycle');
    this.performSearch('motorcycle');
  }

  clearFilters(tab: VehicleTab): void {
    this.resetSearchFilters(tab);
    this.reloadTab(tab);
  }

  changeCarStatus(car: Car, status: VehicleStatus): void {
    const previous = car.status;
    car.status = status;
    const sub = this.carService.changeStatus(car.id, status).subscribe({
      next: () => {
        this.refreshCountsFromState('car');
        void Swal.fire({
          icon: 'success',
          title: 'Estado actualizado',
          text: 'El estado del vehículo fue actualizado correctamente.',
          timer: 2000,
          showConfirmButton: false,
        });
      },
      error: () => {
        car.status = previous;
        void Swal.fire({
          icon: 'error',
          title: 'Error al actualizar el estado',
          text: 'No se pudo actualizar el estado del vehículo.',
        });
      },
    });
    this.subscriptions.push(sub);
  }

  changeMotorcycleStatus(motorcycle: Motorcycle, status: VehicleStatus): void {
    const previous = motorcycle.status;
    motorcycle.status = status;
    const sub = this.motorcycleService
      .changeStatus(motorcycle.id, status)
      .subscribe({
        next: () => {
          this.refreshCountsFromState('motorcycle');
          void Swal.fire({
            icon: 'success',
            title: 'Estado actualizado',
            text: 'El estado del vehículo fue actualizado correctamente.',
            timer: 2000,
            showConfirmButton: false,
          });
        },
        error: () => {
          motorcycle.status = previous;
          void Swal.fire({
            icon: 'error',
            title: 'Error al actualizar el estado',
            text: 'No se pudo actualizar el estado del vehículo.',
          });
        },
      });
    this.subscriptions.push(sub);
  }

  toggleCarAvailability(car: Car): void {
    this.vehicleUiHelper.updateCarStatus(
      car.id,
      car.status === VehicleStatus.INACTIVE
        ? VehicleStatus.AVAILABLE
        : VehicleStatus.INACTIVE,
      () => this.loadCars(this.currentCarPage),
      car.plate,
    );
  }

  toggleMotorcycleAvailability(motorcycle: Motorcycle): void {
    this.vehicleUiHelper.updateMotorcycleStatus(
      motorcycle.id,
      motorcycle.status === VehicleStatus.INACTIVE
        ? VehicleStatus.AVAILABLE
        : VehicleStatus.INACTIVE,
      () => this.loadMotorcycles(this.currentMotorcyclePage),
      motorcycle.plate,
    );
  }

  statusLabel(status: VehicleStatus): string {
    const labels: Record<VehicleStatus, string> = {
      [VehicleStatus.AVAILABLE]: 'Disponible',
      [VehicleStatus.SOLD]: 'Vendido',
      [VehicleStatus.IN_MAINTENANCE]: 'En mantenimiento',
      [VehicleStatus.IN_REPAIR]: 'En reparación',
      [VehicleStatus.IN_USE]: 'En uso',
      [VehicleStatus.INACTIVE]: 'Inactivo',
    };
    return labels[status] ?? status;
  }

  badgeClass(status: VehicleStatus): string {
    switch (status) {
      case VehicleStatus.AVAILABLE:
        return 'bg-success';
      case VehicleStatus.SOLD:
        return 'bg-secondary';
      case VehicleStatus.IN_MAINTENANCE:
        return 'bg-warning text-dark';
      case VehicleStatus.IN_REPAIR:
        return 'bg-danger';
      case VehicleStatus.IN_USE:
        return 'bg-info text-dark';
      case VehicleStatus.INACTIVE:
      default:
        return 'bg-dark';
    }
  }

  private loadCars(page: number): void {
    this.loadVehicles<Car>({
      page,
      state: this.carState,
      type: 'car',
      fetchPager: (requestedPage) =>
        this.carService.getAllPaginated(requestedPage),
      fetchCounts: () => this.carService.getCounts(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('car', resolvedPage),
      errorMessage: 'Error al cargar los automóviles.',
      fallbackCounts: () =>
        this.carService.getAll().pipe(
          map(
            (cars): VehicleFallbackResult<Car> => ({
              ...this.buildFallbackCounts(cars),
              items: cars,
            }),
          ),
        ),
    });
  }

  private loadMotorcycles(page: number): void {
    this.loadVehicles<Motorcycle>({
      page,
      state: this.motorcycleState,
      type: 'motorcycle',
      fetchPager: (requestedPage) =>
        this.motorcycleService.getAllPaginated(requestedPage),
      fetchCounts: () => this.motorcycleService.getCounts(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('motorcycle', resolvedPage),
      errorMessage: 'Error al cargar las motocicletas.',
      fallbackCounts: () =>
        this.motorcycleService.getAll().pipe(
          map(
            (motorcycles): VehicleFallbackResult<Motorcycle> => ({
              ...this.buildFallbackCounts(motorcycles),
              items: motorcycles,
            }),
          ),
        ),
    });
  }

  private loadVehicles<T extends VehicleEntity>(
    config: VehicleLoadConfig<T>,
  ): void {
    const { state, page, fetchPager, fetchCounts, type, onPageResolved } =
      config;
    state.loading = true;
    state.error = null;

    const loader$ = forkJoin({
      pager: fetchPager(page),
      counts: fetchCounts(),
    })
      .pipe(
        finalize(() => {
          state.loading = false;
        }),
      )
      .subscribe({
        next: ({ pager, counts }) => {
          const items = pager.content ?? [];
          state.items = items;
          state.pager = pager;

          const pageCounts = this.computeCountsFromItems(items);
          const { available, unavailable, hasCounts } = this.extractCounts(
            counts,
            type,
          );

          let availableCount = available;
          let unavailableCount = unavailable;

          if (!hasCounts) {
            availableCount = pageCounts.available;
            unavailableCount = pageCounts.unavailable;

            if (
              this.hasTotalElements(pager.totalElements) &&
              (items.length > 0 || Number(pager.numberOfElements) > 0)
            ) {
              const totalElements = Number(pager.totalElements);
              if (unavailableCount === 0 && availableCount <= totalElements) {
                unavailableCount = Math.max(totalElements - availableCount, 0);
              }
            }
          }

          const fallbackNeeded =
            !!config.fallbackCounts &&
            this.shouldFallbackToFullDataset({
              hasCounts,
              expectedAvailable: availableCount,
              expectedUnavailable: unavailableCount,
              pageCounts,
              reportedTotal: pager.totalElements,
            });

          state.available = availableCount;
          state.unavailable = unavailableCount;
          state.total = this.resolveTotal(
            pager.totalElements,
            availableCount,
            unavailableCount,
            items.length,
          );
          onPageResolved(pager.number ?? page ?? 0);

          if (fallbackNeeded && config.fallbackCounts) {
            const fallback$ = config.fallbackCounts().subscribe((fallback) => {
              state.available = fallback.available;
              state.unavailable = fallback.unavailable;
              state.total = fallback.total;

              if (fallback.items) {
                const pageIndex = pager.number ?? page ?? 0;
                const pageSize = this.resolvePageSize(
                  pager,
                  fallback.items.length,
                );
                const pageItems = this.sliceItems(
                  fallback.items,
                  pageIndex,
                  pageSize,
                );

                state.items = pageItems;
                state.pager = this.mergePagerWithFallback(
                  pager,
                  pageItems,
                  fallback.total,
                  pageSize,
                  pageIndex,
                );
              }
            });
            this.subscriptions.push(fallback$);
          }
        },
        error: (err) => {
          console.error(err);
          state.error = config.errorMessage;
          state.items = [];
          state.pager = undefined;
        },
      });

    this.subscriptions.push(loader$);
  }

  private performSearch(tab: VehicleTab): void {
    if (tab === 'car') {
      if (this.areFiltersEmpty(this.carFilters as Record<string, unknown>)) {
        this.reloadTab('car');
        return;
      }

      this.runVehicleSearch<Car>(
        'car',
        this.carState,
        this.carService.search(this.carFilters),
      );
      return;
    }

    if (
      this.areFiltersEmpty(this.motorcycleFilters as Record<string, unknown>)
    ) {
      this.reloadTab('motorcycle');
      return;
    }

    this.runVehicleSearch<Motorcycle>(
      'motorcycle',
      this.motorcycleState,
      this.motorcycleService.search(this.motorcycleFilters),
    );
  }

  private runVehicleSearch<T extends VehicleEntity>(
    tab: VehicleTab,
    state: VehicleListState<T>,
    search$: Observable<T[]>,
  ): void {
    state.loading = true;
    state.error = null;

    const sub = search$
      .pipe(
        finalize(() => {
          state.loading = false;
        }),
      )
      .subscribe({
        next: (items: T[]) => {
          state.items = items;
          state.pager = undefined;
          this.setCountsFromItems(tab, items);
        },
        error: (err: unknown) => {
          console.error(err);
          state.error = 'No fue posible realizar la búsqueda.';
        },
      });

    this.subscriptions.push(sub);
  }

  private reloadTab(tab: VehicleTab): void {
    if (tab === 'car') {
      this.loadCars(this.currentCarPage);
      return;
    }
    this.loadMotorcycles(this.currentMotorcyclePage);
  }

  private parsePage(raw: string | null): number {
    if (!raw) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  private normalizeTab(raw: unknown): VehicleTab {
    return raw === 'motorcycle' ? 'motorcycle' : 'car';
  }

  private resetSearchFilters(tab: VehicleTab): void {
    if (tab === 'car') {
      this.carFilters = this.createCarFilterState();
      this.carPriceInputs = { minSalePrice: '', maxSalePrice: '' };
      return;
    }
    this.motorcycleFilters = this.createMotorcycleFilterState();
    this.motorcyclePriceInputs = { minSalePrice: '', maxSalePrice: '' };
  }

  onCarPriceInput(field: 'minSalePrice' | 'maxSalePrice', rawValue: string): void {
    const { numericValue, displayValue } = normalizeMoneyInput(
      rawValue,
      this.priceDecimals,
    );
    this.carPriceInputs[field] = displayValue;
    this.carFilters[field] = numericValue;
  }

  onMotorcyclePriceInput(
    field: 'minSalePrice' | 'maxSalePrice',
    rawValue: string,
  ): void {
    const { numericValue, displayValue } = normalizeMoneyInput(
      rawValue,
      this.priceDecimals,
    );
    this.motorcyclePriceInputs[field] = displayValue;
    this.motorcycleFilters[field] = numericValue;
  }

  private syncPriceFilters(tab: VehicleTab): void {
    if (tab === 'car') {
      this.onCarPriceInput('minSalePrice', this.carPriceInputs.minSalePrice);
      this.onCarPriceInput('maxSalePrice', this.carPriceInputs.maxSalePrice);
      return;
    }
    this.onMotorcyclePriceInput(
      'minSalePrice',
      this.motorcyclePriceInputs.minSalePrice,
    );
    this.onMotorcyclePriceInput(
      'maxSalePrice',
      this.motorcyclePriceInputs.maxSalePrice,
    );
  }

  private createInitialState<T extends VehicleEntity>(): VehicleListState<T> {
    return {
      items: [],
      pager: undefined,
      total: 0,
      available: 0,
      unavailable: 0,
      loading: false,
      error: null,
    };
  }

  private createCarFilterState(): CarSearchFilters {
    return {
      plate: '',
      brand: '',
      line: '',
      model: '',
      fuelType: '',
      bodyType: '',
      transmission: '',
      cityRegistered: '',
      status: '',
      minYear: null,
      maxYear: null,
      minCapacity: null,
      maxCapacity: null,
      minMileage: null,
      maxMileage: null,
      minSalePrice: null,
      maxSalePrice: null,
    };
  }

  private createMotorcycleFilterState(): MotorcycleSearchFilters {
    return {
      plate: '',
      brand: '',
      line: '',
      model: '',
      motorcycleType: '',
      transmission: '',
      cityRegistered: '',
      status: '',
      minYear: null,
      maxYear: null,
      minCapacity: null,
      maxCapacity: null,
      minMileage: null,
      maxMileage: null,
      minSalePrice: null,
      maxSalePrice: null,
    };
  }

  private getCurrentPage(tab: VehicleTab): number {
    return tab === 'car' ? this.currentCarPage : this.currentMotorcyclePage;
  }

  private setCurrentPage(tab: VehicleTab, page: number): void {
    if (tab === 'car') {
      this.currentCarPage = page;
      return;
    }
    this.currentMotorcyclePage = page;
  }

  private navigateToPage(page: number, tab: VehicleTab): void {
    const commands =
      tab === 'car'
        ? ['/vehicles/cars/page', page]
        : ['/vehicles/motorcycles/page', page];
    void this.router.navigate(commands);
  }

  private computeCountsFromItems(items: VehicleEntity[]): {
    available: number;
    unavailable: number;
  } {
    const available = items.filter(
      (item) => item.status === VehicleStatus.AVAILABLE,
    ).length;
    return {
      available,
      unavailable: items.length - available,
    };
  }

  private extractCounts(
    counts: VehicleCount,
    type: VehicleTab,
  ): {
    available: number;
    unavailable: number;
    hasCounts: boolean;
  } {
    if (!counts || typeof counts !== 'object') {
      return { available: 0, unavailable: 0, hasCounts: false };
    }

    const source = counts as unknown as Record<string, unknown>;

    const availableKeys =
      type === 'car'
        ? ['availableCars', 'available', 'availableVehicles']
        : ['availableMotorcycles', 'available', 'availableVehicles'];
    const unavailableKeys =
      type === 'car'
        ? ['unavailableCars', 'unavailable', 'unavailableVehicles']
        : ['unavailableMotorcycles', 'unavailable', 'unavailableVehicles'];

    const { value: availableValue, found: availableFound } = this.pickFirst(
      source,
      availableKeys,
    );
    const { value: unavailableValue, found: unavailableFound } = this.pickFirst(
      source,
      unavailableKeys,
    );

    return {
      available: this.normalizeCount(availableValue),
      unavailable: this.normalizeCount(unavailableValue),
      hasCounts: availableFound || unavailableFound,
    };
  }

  private pickFirst(
    source: Record<string, unknown>,
    keys: string[],
  ): {
    value: unknown;
    found: boolean;
  } {
    for (const key of keys) {
      if (key in source) {
        return { value: source[key], found: true };
      }
    }
    return { value: undefined, found: false };
  }

  private shouldFallbackToFullDataset(context: {
    hasCounts: boolean;
    expectedAvailable: number;
    expectedUnavailable: number;
    pageCounts: { available: number; unavailable: number };
    reportedTotal: number | undefined;
  }): boolean {
    if (!context.hasCounts) {
      return true;
    }

    const expectedTotal =
      Math.max(context.expectedAvailable, 0) +
      Math.max(context.expectedUnavailable, 0);
    const reportedTotal = Number(context.reportedTotal);
    const hasReportedTotal = Number.isFinite(reportedTotal);

    if (
      expectedTotal > 0 &&
      (!hasReportedTotal || reportedTotal < expectedTotal)
    ) {
      return true;
    }

    if (
      context.expectedUnavailable > 0 &&
      context.pageCounts.unavailable === 0
    ) {
      return true;
    }

    return false;
  }

  private resolveTotal(
    totalElements: number | undefined,
    available: number,
    unavailable: number,
    fallbackLength: number,
  ): number {
    const parsedTotal = Number(totalElements);
    if (Number.isFinite(parsedTotal)) {
      return parsedTotal;
    }

    const sum = available + unavailable;
    return sum > 0 ? sum : fallbackLength;
  }

  private hasTotalElements(value: number | undefined | null): value is number {
    const parsed = Number(value);
    return Number.isFinite(parsed);
  }

  private resolvePageSize<T extends VehicleEntity>(
    pager: PaginatedResponse<T>,
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

  private sliceItems<T extends VehicleEntity>(
    items: T[],
    pageIndex: number,
    pageSize: number,
  ): T[] {
    if (pageSize <= 0) {
      return [...items];
    }
    const start = pageIndex * pageSize;
    return items.slice(start, start + pageSize);
  }

  private mergePagerWithFallback<T extends VehicleEntity>(
    pager: PaginatedResponse<T>,
    pageItems: T[],
    totalElements: number,
    pageSize: number,
    pageIndex: number,
  ): PaginatedResponse<T> {
    const totalPages = this.calculateTotalPages(totalElements, pageSize);

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

  private calculateTotalPages(totalElements: number, pageSize: number): number {
    if (pageSize <= 0) {
      return totalElements > 0 ? 1 : 0;
    }
    return Math.max(Math.ceil(totalElements / pageSize), 1);
  }

  private normalizeCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildFallbackCounts<T extends VehicleEntity>(
    items: T[],
  ): {
    available: number;
    unavailable: number;
    total: number;
  } {
    const counts = this.computeCountsFromItems(items);
    const total = items.length;
    return {
      available: counts.available,
      unavailable: counts.unavailable,
      total,
    };
  }

  private setCountsFromItems(tab: VehicleTab, items: VehicleEntity[]): void {
    const counts = this.computeCountsFromItems(items);
    const state = tab === 'car' ? this.carState : this.motorcycleState;
    state.available = counts.available;
    state.unavailable = counts.unavailable;
    state.total = items.length;
  }

  private refreshCountsFromState(tab: VehicleTab): void {
    const state = tab === 'car' ? this.carState : this.motorcycleState;
    this.setCountsFromItems(tab, state.items);
  }

  private areFiltersEmpty(filters: Record<string, unknown>): boolean {
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

  protected toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
