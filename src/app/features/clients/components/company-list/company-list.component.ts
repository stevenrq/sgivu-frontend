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
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { RowNavigateDirective } from '../../../../shared/directives/row-navigate.directive';
import {
  CompanySearchFilters,
  CompanyService,
} from '../../services/company.service';
import { Company } from '../../models/company.model';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';
import { ListPageManager } from '../../../../shared/utils/list-page-manager';
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

type FilterEnabled = boolean | '' | 'true' | 'false';

const COMPANY_FILTER_MAPPINGS: FilterFieldMapping[] = [
  { queryKey: 'companyName', filterKey: 'companyName', type: 'string' },
  { queryKey: 'companyTaxId', filterKey: 'taxId', type: 'string' },
  { queryKey: 'companyEmail', filterKey: 'email', type: 'string' },
  { queryKey: 'companyPhone', filterKey: 'phoneNumber', type: 'string' },
  { queryKey: 'companyCity', filterKey: 'city', type: 'string' },
  { queryKey: 'companyEnabled', filterKey: 'enabled', type: 'boolean' },
];

/**
 * Sub-componente de listado de clientes empresas.
 * Incluye búsqueda por nombre de empresa, filtros avanzados (NIT, email, teléfono, ciudad, estado)
 * y paginación sincronizada con los query params de la URL.
 * Es utilizado por `ClientListComponent` dentro de la pestaña "Empresas".
 */
@Component({
  selector: 'app-company-list',
  imports: [
    NgClass,
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    PagerComponent,
    KpiCardComponent,
    DataTableComponent,
    RowNavigateDirective,
    QuickSearchBarComponent,
    FilterChipGroupComponent,
  ],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyListComponent implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientUiHelper = inject(ClientUiHelperService);
  private readonly destroyRef = inject(DestroyRef);

  readonly listManager = new ListPageManager<Company>(this.destroyRef);

  filters: CompanySearchFilters & { enabled?: FilterEnabled } =
    this.createFilterState();

  private activeFilters: CompanySearchFilters | null = null;
  private queryParams: Params | null = null;

  readonly pagerUrl = '/clients/companies/page';
  readonly pagerLabel = 'empresas';

  readonly enabledChipOptions: ChipOption[] = [
    { value: 'true', label: 'Activas' },
    { value: 'false', label: 'Inactivas' },
  ];

  protected get activeChips(): ActiveFilterChip[] {
    return buildActiveChips(
      this.filters,
      COMPANY_FILTER_MAPPINGS,
      (filterKey, value) => {
        switch (filterKey) {
          case 'companyName':
            return null;
          case 'taxId':
            return `NIT: ${value}`;
          case 'email':
            return `Email: ${value}`;
          case 'phoneNumber':
            return `Tel: ${value}`;
          case 'city':
            return `Ciudad: ${value}`;
          case 'enabled':
            return value === 'true' || value === true
              ? 'Estado: Activa'
              : 'Estado: Inactiva';
          default:
            return null;
        }
      },
    );
  }

  protected showAdvancedFilters = false;

  protected get advancedFiltersCount(): number {
    let count = 0;
    if (this.filters.taxId) count++;
    if (this.filters.email) count++;
    if (this.filters.phoneNumber) count++;
    if (this.filters.city) count++;
    if (this.filters.enabled) count++;
    return count;
  }

  protected onSearchValueChange(value: string): void {
    this.filters = { ...this.filters, companyName: value };
  }

  protected clearSearchTerm(): void {
    this.filters = { ...this.filters, companyName: '' };
    this.applyFilters();
  }

  protected removeFilter(filterKey: string): void {
    const defaults = this.createFilterState() as Record<string, unknown>;
    (this.filters as Record<string, unknown>)[filterKey] =
      defaults[filterKey] ?? '';
    this.applyFilters();
  }

  get activePagerQueryParams(): Params | null {
    return this.queryParams;
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const page = ListPageManager.parsePage(params.get('page'));
        const filterInfo = extractFiltersFromQuery<
          CompanySearchFilters & { enabled?: FilterEnabled }
        >(query, COMPANY_FILTER_MAPPINGS, () => this.createFilterState());

        this.filters = filterInfo.uiState;
        this.activeFilters = filterInfo.filters;
        this.queryParams = filterInfo.queryParams;

        if (page < 0) {
          this.navigateToPage(0, filterInfo.queryParams ?? undefined);
          return;
        }

        this.loadCompanies(page, this.activeFilters ?? undefined);
      });
  }

  protected applyFilters(): void {
    const filters = this.buildFilters();
    if (ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)) {
      this.navigateToPage(0);
      return;
    }
    const qp = buildQueryParams(filters, COMPANY_FILTER_MAPPINGS);
    this.navigateToPage(0, qp ?? undefined);
  }

  protected clearFilters(): void {
    this.filters = this.createFilterState();
    this.activeFilters = null;
    this.queryParams = null;
    this.navigateToPage(0);
  }

  protected goToPage(page: number): void {
    this.navigateToPage(page, this.queryParams ?? undefined);
  }

  /**
   * Solicita confirmación y cambia el estado habilitado/deshabilitado de la empresa indicada.
   *
   * @param company - Empresa cuyo estado se desea cambiar.
   */
  protected toggleStatus(company: Company): void {
    this.clientUiHelper.updateCompanyStatus(
      company.id,
      !company.enabled,
      () =>
        this.loadCompanies(
          this.listManager.currentPage(),
          this.activeFilters ?? undefined,
        ),
      company.companyName,
    );
  }

  private loadCompanies(page: number, filters?: CompanySearchFilters): void {
    const activeFilters =
      filters &&
      !ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;

    this.listManager.loadPage(
      {
        fetchPager: (p) =>
          activeFilters
            ? this.companyService.searchPaginated(p, activeFilters)
            : this.companyService.getAllPaginated(p),
        fetchCounts: () => this.companyService.getCompanyCount(),
        errorMessage: 'Error al cargar las empresas.',
        countKeys: {
          active: [
            'activeCompanies',
            'activeClients',
            'activeOrganizations',
            'active',
          ],
          inactive: [
            'inactiveCompanies',
            'inactiveClients',
            'inactiveOrganizations',
            'inactive',
          ],
        },
        computeCountsFn: ListPageManager.computeEnabledCounts,
        fallbackCounts: activeFilters
          ? undefined
          : () =>
              this.companyService.getAll().pipe(
                map((companies) => ({
                  ...ListPageManager.computeEnabledCounts(companies),
                  total: companies.length,
                  items: companies,
                })),
              ),
      },
      page,
    );
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    const commands = ['/clients/companies/page', page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  private createFilterState(): CompanySearchFilters & {
    enabled?: FilterEnabled;
  } {
    return {
      companyName: '',
      taxId: '',
      email: '',
      phoneNumber: '',
      city: '',
      enabled: '',
    };
  }

  private buildFilters(): CompanySearchFilters {
    const f = this.filters;
    return {
      companyName: ListPageManager.normalizeFilterValue(f.companyName),
      taxId: ListPageManager.normalizeFilterValue(f.taxId),
      email: ListPageManager.normalizeFilterValue(f.email),
      phoneNumber: ListPageManager.normalizeFilterValue(f.phoneNumber),
      city: ListPageManager.normalizeFilterValue(f.city),
      enabled: ListPageManager.normalizeStatus(f.enabled),
    };
  }
}
