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
import {
  MotorcycleService,
  MotorcycleSearchFilters,
} from '../../services/motorcycle.service';
import { Motorcycle } from '../../models/motorcycle.model';
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

const MOTORCYCLE_FILTER_MAPPINGS: FilterFieldMapping[] = [
  { queryKey: 'motorcyclePlate', filterKey: 'plate', type: 'string' },
  { queryKey: 'motorcycleBrand', filterKey: 'brand', type: 'string' },
  { queryKey: 'motorcycleLine', filterKey: 'line', type: 'string' },
  { queryKey: 'motorcycleModel', filterKey: 'model', type: 'string' },
  { queryKey: 'motorcycleType', filterKey: 'motorcycleType', type: 'string' },
  {
    queryKey: 'motorcycleTransmission',
    filterKey: 'transmission',
    type: 'string',
  },
  { queryKey: 'motorcycleCity', filterKey: 'cityRegistered', type: 'string' },
  { queryKey: 'motorcycleStatus', filterKey: 'status', type: 'enum' },
  { queryKey: 'motorcycleMinYear', filterKey: 'minYear', type: 'number' },
  { queryKey: 'motorcycleMaxYear', filterKey: 'maxYear', type: 'number' },
  {
    queryKey: 'motorcycleMinCapacity',
    filterKey: 'minCapacity',
    type: 'number',
  },
  {
    queryKey: 'motorcycleMaxCapacity',
    filterKey: 'maxCapacity',
    type: 'number',
  },
  { queryKey: 'motorcycleMinMileage', filterKey: 'minMileage', type: 'number' },
  { queryKey: 'motorcycleMaxMileage', filterKey: 'maxMileage', type: 'number' },
  {
    queryKey: 'motorcycleMinSalePrice',
    filterKey: 'minSalePrice',
    type: 'price',
  },
  {
    queryKey: 'motorcycleMaxSalePrice',
    filterKey: 'maxSalePrice',
    type: 'price',
  },
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
 * Sub-componente de listado de motocicletas del inventario.
 * Incluye búsqueda rápida por placa/marca, filtros avanzados (tipo de moto, transmisión,
 * año, cilindrada, kilometraje, precio, estado, ciudad) y paginación sincronizada
 * con los query params de la URL.
 * Es utilizado por `VehicleListComponent` dentro de la pestaña "Motocicletas".
 */
@Component({
  selector: 'app-motorcycle-list',
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
  templateUrl: './motorcycle-list.component.html',
  styleUrl: './motorcycle-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotorcycleListComponent implements OnInit {
  private readonly motorcycleService = inject(MotorcycleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehicleUiHelper = inject(VehicleUiHelperService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly listManager = new ListPageManager<Motorcycle>(this.destroyRef);
  readonly VehicleStatus = VehicleStatus;
  readonly vehicleStatuses = Object.values(VehicleStatus);

  readonly vehicleStatusChipOptions: ChipOption[] = Object.values(
    VehicleStatus,
  ).map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }));

  filters: MotorcycleSearchFilters = this.createFilterState();

  private activeFilters: MotorcycleSearchFilters | null = null;
  private queryParams: Params | null = null;

  readonly pagerUrl = '/vehicles/motorcycles/page';

  get activePagerQueryParams(): Params | null {
    return this.queryParams;
  }

  protected get activeChips(): ActiveFilterChip[] {
    return buildActiveChips(
      this.filters,
      MOTORCYCLE_FILTER_MAPPINGS,
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
          case 'motorcycleType':
            return `Tipo: ${value}`;
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
            return `Cilindrada ≥ ${value} cc`;
          case 'maxCapacity':
            return `Cilindrada ≤ ${value} cc`;
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
      f.motorcycleType,
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
        const filterInfo = extractFiltersFromQuery<MotorcycleSearchFilters>(
          query,
          MOTORCYCLE_FILTER_MAPPINGS,
          () => this.createFilterState(),
        );

        this.filters = filterInfo.uiState;
        this.activeFilters = filterInfo.filters;
        this.queryParams = filterInfo.queryParams;

        if (page < 0) {
          this.navigateToPage(0, filterInfo.queryParams ?? undefined);
          return;
        }

        this.loadMotorcycles(page, this.activeFilters ?? undefined);
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
    const qp = buildQueryParams(this.filters, MOTORCYCLE_FILTER_MAPPINGS);
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

  protected changeStatus(motorcycle: Motorcycle, status: VehicleStatus): void {
    const previous = motorcycle.status;
    motorcycle.status = status;
    this.motorcycleService
      .changeStatus(motorcycle.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(
            'El estado del vehículo fue actualizado correctamente.',
          );
        },
        error: () => {
          motorcycle.status = previous;
          this.toast.error('No se pudo actualizar el estado del vehículo.');
        },
      });
  }

  protected toggleAvailability(motorcycle: Motorcycle): void {
    this.vehicleUiHelper.updateMotorcycleStatus(
      motorcycle.id,
      motorcycle.status === VehicleStatus.INACTIVE
        ? VehicleStatus.AVAILABLE
        : VehicleStatus.INACTIVE,
      () =>
        this.loadMotorcycles(
          this.listManager.currentPage(),
          this.activeFilters ?? undefined,
        ),
      motorcycle.plate,
    );
  }

  protected statusLabel(status: VehicleStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  private static computeVehicleCounts(items: Motorcycle[]): {
    active: number;
    inactive: number;
  } {
    const active = items.filter(
      (item) => item.status === VehicleStatus.AVAILABLE,
    ).length;
    return { active, inactive: items.length - active };
  }

  private loadMotorcycles(
    page: number,
    filters?: MotorcycleSearchFilters,
  ): void {
    const activeFilters =
      filters &&
      !ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;

    this.listManager.loadPage(
      {
        fetchPager: (p) =>
          activeFilters
            ? this.motorcycleService.searchPaginated(p, activeFilters)
            : this.motorcycleService.getAllPaginated(p),
        fetchCounts: () => this.motorcycleService.getCounts(),
        errorMessage: 'Error al cargar las motocicletas.',
        countKeys: {
          active: ['availableMotorcycles', 'available', 'availableVehicles'],
          inactive: [
            'unavailableMotorcycles',
            'unavailable',
            'unavailableVehicles',
          ],
        },
        computeCountsFn: MotorcycleListComponent.computeVehicleCounts,
        fallbackCounts: activeFilters
          ? undefined
          : () =>
              this.motorcycleService.getAll().pipe(
                map(
                  (motorcycles): FallbackCountsResult<Motorcycle> => ({
                    ...MotorcycleListComponent.computeVehicleCounts(
                      motorcycles,
                    ),
                    total: motorcycles.length,
                    items: motorcycles,
                  }),
                ),
              ),
      },
      page,
    );
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    const commands = ['/vehicles/motorcycles/page', page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  private createFilterState(): MotorcycleSearchFilters {
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
}
