import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute, Params } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { ToastService } from '../../../../shared/services/toast.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { RowNavigateDirective } from '../../../../shared/directives/row-navigate.directive';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { CarService, CarSearchFilters } from '../../services/car.service';
import { Car } from '../../models/car.model';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { VehicleUiHelperService } from '../../../../shared/services/vehicle-ui-helper.service';
import {
  ListPageManager,
  FallbackCountsResult,
} from '../../../../shared/utils/list-page-manager';
import {
  FilterFieldMapping,
  extractFiltersFromQuery,
  buildQueryParams,
  buildActiveChips,
  ActiveFilterChip,
} from '../../../../shared/utils/filter-query.utils';
import { QuickSearchBarComponent } from '../../../../shared/components/quick-search-bar/quick-search-bar.component';
import {
  FilterChipGroupComponent,
  ChipOption,
} from '../../../../shared/components/filter-chip-group/filter-chip-group.component';
import { RangeInputComponent } from '../../../../shared/components/range-input/range-input.component';

const CAR_FILTER_MAPPINGS: FilterFieldMapping[] = [
  { queryKey: 'carPlate', filterKey: 'plate', type: 'string' },
  { queryKey: 'carBrand', filterKey: 'brand', type: 'string' },
  { queryKey: 'carLine', filterKey: 'line', type: 'string' },
  { queryKey: 'carModel', filterKey: 'model', type: 'string' },
  { queryKey: 'carFuelType', filterKey: 'fuelType', type: 'string' },
  { queryKey: 'carBodyType', filterKey: 'bodyType', type: 'string' },
  { queryKey: 'carTransmission', filterKey: 'transmission', type: 'string' },
  { queryKey: 'carCity', filterKey: 'cityRegistered', type: 'string' },
  { queryKey: 'carStatus', filterKey: 'status', type: 'enum' },
  { queryKey: 'carMinYear', filterKey: 'minYear', type: 'number' },
  { queryKey: 'carMaxYear', filterKey: 'maxYear', type: 'number' },
  { queryKey: 'carMinCapacity', filterKey: 'minCapacity', type: 'number' },
  { queryKey: 'carMaxCapacity', filterKey: 'maxCapacity', type: 'number' },
  { queryKey: 'carMinMileage', filterKey: 'minMileage', type: 'number' },
  { queryKey: 'carMaxMileage', filterKey: 'maxMileage', type: 'number' },
  { queryKey: 'carMinSalePrice', filterKey: 'minSalePrice', type: 'price' },
  { queryKey: 'carMaxSalePrice', filterKey: 'maxSalePrice', type: 'price' },
];

const STATUS_LABELS: Record<VehicleStatus, string> = {
  [VehicleStatus.AVAILABLE]: 'Disponible',
  [VehicleStatus.SOLD]: 'Vendido',
  [VehicleStatus.IN_MAINTENANCE]: 'Mantenimiento',
  [VehicleStatus.IN_REPAIR]: 'Reparación',
  [VehicleStatus.IN_USE]: 'En uso',
  [VehicleStatus.INACTIVE]: 'Inactivo',
};

/**
 * Sub-componente de listado de automóviles del inventario.
 * Incluye búsqueda rápida por placa/marca, filtros avanzados (tipo de carrocería, combustible,
 * transmisión, año, capacidad, kilometraje, precio, estado, ciudad) y paginación sincronizada
 * con los query params de la URL.
 * Es utilizado por `VehicleListComponent` dentro de la pestaña "Automóviles".
 */
@Component({
  selector: 'app-car-list',
  imports: [
    NgClass,
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    PagerComponent,
    KpiCardComponent,
    DataTableComponent,
    CopCurrencyPipe,
    RowNavigateDirective,
    QuickSearchBarComponent,
    FilterChipGroupComponent,
    RangeInputComponent,
  ],
  templateUrl: './car-list.component.html',
  styleUrl: './car-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarListComponent implements OnInit {
  private readonly carService = inject(CarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehicleUiHelper = inject(VehicleUiHelperService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly listManager = new ListPageManager<Car>(this.destroyRef);
  readonly VehicleStatus = VehicleStatus;
  readonly vehicleStatuses = Object.values(VehicleStatus);

  readonly vehicleStatusChipOptions: ChipOption[] = Object.values(
    VehicleStatus,
  ).map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }));

  filters: CarSearchFilters = this.createFilterState();

  private activeFilters: CarSearchFilters | null = null;
  private queryParams: Params | null = null;

  readonly pagerUrl = '/vehicles/cars/page';

  get activePagerQueryParams(): Params | null {
    return this.queryParams;
  }

  protected get activeChips(): ActiveFilterChip[] {
    return buildActiveChips(
      this.filters,
      CAR_FILTER_MAPPINGS,
      (filterKey, value) => {
        switch (filterKey) {
          case 'plate':
            return null;
          case 'brand':
            return `Marca: ${value}`;
          case 'line':
            return `Línea: ${value}`;
          case 'model':
            return `Modelo: ${value}`;
          case 'fuelType':
            return `Combustible: ${value}`;
          case 'bodyType':
            return `Carrocería: ${value}`;
          case 'transmission':
            return `Transmisión: ${value}`;
          case 'cityRegistered':
            return `Ciudad: ${value}`;
          case 'status':
            return `Estado: ${STATUS_LABELS[value as VehicleStatus] ?? value}`;
          case 'minYear':
            return `Año ≥ ${value}`;
          case 'maxYear':
            return `Año ≤ ${value}`;
          case 'minMileage':
            return `Km ≥ ${value}`;
          case 'maxMileage':
            return `Km ≤ ${value}`;
          case 'minCapacity':
            return `Capacidad ≥ ${value} cc`;
          case 'maxCapacity':
            return `Capacidad ≤ ${value} cc`;
          case 'minSalePrice':
            return `Precio ≥ $${Number(value).toLocaleString('es-CO')}`;
          case 'maxSalePrice':
            return `Precio ≤ $${Number(value).toLocaleString('es-CO')}`;
          default:
            return null;
        }
      },
    );
  }

  protected showAdvancedFilters = false;

  protected get advancedFiltersCount(): number {
    const f = this.filters;
    return [
      f.brand,
      f.line,
      f.model,
      f.fuelType,
      f.bodyType,
      f.transmission,
      f.cityRegistered,
      f.status,
      f.minYear,
      f.maxYear,
      f.minCapacity,
      f.maxCapacity,
      f.minMileage,
      f.maxMileage,
      f.minSalePrice,
      f.maxSalePrice,
    ].filter((v) => v !== null && v !== undefined && v !== '').length;
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const page = ListPageManager.parsePage(params.get('page'));
        const filterInfo = extractFiltersFromQuery<CarSearchFilters>(
          query,
          CAR_FILTER_MAPPINGS,
          () => this.createFilterState(),
        );

        this.filters = filterInfo.uiState;
        this.activeFilters = filterInfo.filters;
        this.queryParams = filterInfo.queryParams;

        if (page < 0) {
          this.navigateToPage(0, filterInfo.queryParams ?? undefined);
          return;
        }

        this.loadCars(page, this.activeFilters ?? undefined);
      });
  }

  protected onSearchValueChange(value: string): void {
    this.filters = { ...this.filters, plate: value };
  }

  protected applyFilters(): void {
    if (
      ListPageManager.areFiltersEmpty(this.filters as Record<string, unknown>)
    ) {
      this.clearFilters();
      return;
    }
    const qp = buildQueryParams(this.filters, CAR_FILTER_MAPPINGS);
    this.navigateToPage(0, qp ?? undefined);
  }

  protected clearFilters(): void {
    this.filters = this.createFilterState();
    this.activeFilters = null;
    this.queryParams = null;
    this.navigateToPage(0);
  }

  protected clearSearchTerm(): void {
    this.filters = { ...this.filters, plate: '' };
    this.applyFilters();
  }

  protected removeFilter(filterKey: string): void {
    const defaults = this.createFilterState() as Record<string, unknown>;
    (this.filters as Record<string, unknown>)[filterKey] =
      defaults[filterKey] ?? null;
    this.applyFilters();
  }

  protected changeStatus(car: Car, status: VehicleStatus): void {
    const previous = car.status;
    car.status = status;
    this.carService
      .changeStatus(car.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(
            'El estado del vehículo fue actualizado correctamente.',
          );
        },
        error: () => {
          car.status = previous;
          this.toast.error('No se pudo actualizar el estado del vehículo.');
        },
      });
  }

  protected toggleAvailability(car: Car): void {
    this.vehicleUiHelper.updateCarStatus(
      car.id,
      car.status === VehicleStatus.INACTIVE
        ? VehicleStatus.AVAILABLE
        : VehicleStatus.INACTIVE,
      () =>
        this.loadCars(
          this.listManager.currentPage(),
          this.activeFilters ?? undefined,
        ),
      car.plate,
    );
  }

  protected statusLabel(status: VehicleStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  private static computeVehicleCounts(items: Car[]): {
    active: number;
    inactive: number;
  } {
    const active = items.filter(
      (item) => item.status === VehicleStatus.AVAILABLE,
    ).length;
    return { active, inactive: items.length - active };
  }

  private loadCars(page: number, filters?: CarSearchFilters): void {
    const activeFilters =
      filters &&
      !ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;

    this.listManager.loadPage(
      {
        fetchPager: (p) =>
          activeFilters
            ? this.carService.searchPaginated(p, activeFilters)
            : this.carService.getAllPaginated(p),
        fetchCounts: () => this.carService.getCounts(),
        errorMessage: 'Error al cargar los automóviles.',
        countKeys: {
          active: ['availableCars', 'available', 'availableVehicles'],
          inactive: ['unavailableCars', 'unavailable', 'unavailableVehicles'],
        },
        computeCountsFn: CarListComponent.computeVehicleCounts,
        fallbackCounts: activeFilters
          ? undefined
          : () =>
              this.carService.getAll().pipe(
                map(
                  (cars): FallbackCountsResult<Car> => ({
                    ...CarListComponent.computeVehicleCounts(cars),
                    total: cars.length,
                    items: cars,
                  }),
                ),
              ),
      },
      page,
    );
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    const commands = ['/vehicles/cars/page', page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  private createFilterState(): CarSearchFilters {
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
}
