import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Router,
  RouterLink,
  ActivatedRoute,
  ParamMap,
  Params,
} from '@angular/router';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import {
  PersonSearchFilters,
  PersonService,
} from '../../services/person.service';
import {
  CompanySearchFilters,
  CompanyService,
} from '../../services/company.service';
import {
  Observable,
  Subscription,
  combineLatest,
  finalize,
  forkJoin,
  map,
} from 'rxjs';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';
import { Company } from '../../models/company.model';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { Person } from '../../models/person.model.';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

type ClientTab = 'person' | 'company';

type ClientEntity = Person | Company;

interface ClientListState<T extends ClientEntity> {
  items: T[];
  pager?: PaginatedResponse<T>;
  active: number;
  inactive: number;
  total: number;
  loading: boolean;
  error: string | null;
}

interface ClientTabMetadata {
  pagerUrl: string;
  pagerLabel: string;
  createPermission: string;
  createLink: string[];
  createLabel: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  routeBase: string[];
}

interface ClientLoadConfig<T extends ClientEntity> {
  page: number;
  state: ClientListState<T>;
  type: ClientTab;
  fetchPager: (page: number) => Observable<PaginatedResponse<T>>;
  fetchCounts: () => Observable<unknown>;
  onPageResolved: (page: number) => void;
  errorMessage: string;
  fallbackCounts?: () => Observable<ClientCountsResult<T>>;
}

interface ClientCountsResult<T extends ClientEntity = ClientEntity> {
  active: number;
  inactive: number;
  total: number;
  items?: T[];
}

@Component({
  selector: 'app-client-list',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    PagerComponent,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
  ],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.css',
})
/**
 * Administra el catálogo de clientes personas y empresas. Mantiene sincronía
 * entre los filtros almacenados en la URL, los contadores de cada tab y las
 * estrategias de fallback para cuando la API no entrega datos consistentes.
 */
export class ClientListComponent implements OnInit, OnDestroy {
  personFilters: PersonSearchFilters & { enabled?: boolean | '' | 'true' | 'false' } =
    this.createPersonFilterState();
  companyFilters: CompanySearchFilters & {
    enabled?: boolean | '' | 'true' | 'false';
  } =
    this.createCompanyFilterState();

  activeTab: ClientTab = 'person';

  private readonly tabMetadata: Record<ClientTab, ClientTabMetadata> = {
    person: {
      pagerUrl: '/clients/persons/page',
      pagerLabel: 'personas',
      createPermission: 'person:create',
      createLink: ['/clients/persons/create'],
      createLabel: 'Registrar persona',
      title: 'Personas registradas',
      subtitle:
        'Administra clientes personas naturales, su información de contacto y estado.',
      searchPlaceholder: 'Buscar personas naturales...',
      emptyMessage: 'No existen personas registradas en este momento.',
      routeBase: ['/clients/persons/page'],
    },
    company: {
      pagerUrl: '/clients/companies/page',
      pagerLabel: 'empresas',
      createPermission: 'company:create',
      createLink: ['/clients/companies/create'],
      createLabel: 'Registrar empresa',
      title: 'Empresas registradas',
      subtitle: 'Administra clientes empresas, sus datos tributarios y estado.',
      searchPlaceholder: 'Buscar empresas...',
      emptyMessage: 'No existen empresas registradas en este momento.',
      routeBase: ['/clients/companies/page'],
    },
  };

  readonly personState = this.createInitialState<Person>();
  readonly companyState = this.createInitialState<Company>();

  private readonly subscriptions: Subscription[] = [];

  private currentPersonPage = 0;
  private currentCompanyPage = 0;
  private activePersonFilters: PersonSearchFilters | null = null;
  private activeCompanyFilters: CompanySearchFilters | null = null;
  private personQueryParams: Params | null = null;
  private companyQueryParams: Params | null = null;

  constructor(
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientUiHelper: ClientUiHelperService,
  ) {}

  ngOnInit(): void {
    const routeSub = combineLatest([
      this.route.paramMap,
      this.route.data,
      this.route.queryParamMap,
    ]).subscribe(([params, data, query]) => {
      const requestedTab = this.normalizeTab(data['clientType']);
      const hasTabChanged = this.activeTab !== requestedTab;
      this.activeTab = requestedTab;

      if (hasTabChanged) {
        this.resetSearchState();
      }

      const pageParam = params.get('page');
      const page = this.parsePage(pageParam);

      const filterInfo =
        this.activeTab === 'person'
          ? this.extractPersonFiltersFromQuery(query)
          : this.extractCompanyFiltersFromQuery(query);

      if (this.activeTab === 'person') {
        this.personFilters = filterInfo.uiState;
        this.activePersonFilters = filterInfo.filters;
        this.personQueryParams = filterInfo.queryParams;
      } else {
        this.companyFilters = filterInfo.uiState;
        this.activeCompanyFilters = filterInfo.filters;
        this.companyQueryParams = filterInfo.queryParams;
      }

      if (page < 0) {
        this.navigateToPage(0, this.activeTab, filterInfo.queryParams ?? undefined);
        return;
      }

      if (this.activeTab === 'person') {
        this.loadPersons(page, this.activePersonFilters ?? undefined);
      } else {
        this.loadCompanies(page, this.activeCompanyFilters ?? undefined);
      }
    });

    this.subscriptions.push(routeSub);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  get activeState(): ClientListState<Person> | ClientListState<Company> {
    return this.activeTab === 'person' ? this.personState : this.companyState;
  }

  private get activeMetadata(): ClientTabMetadata {
    return this.tabMetadata[this.activeTab];
  }

  get activePager(): PaginatedResponse<Person | Company> | undefined {
    if (this.activeTab === 'person') {
      return this.personState.pager as
        | PaginatedResponse<Person | Company>
        | undefined;
    }
    return this.companyState.pager as
      | PaginatedResponse<Person | Company>
      | undefined;
  }

  get activePagerUrl(): string {
    return this.activeMetadata.pagerUrl;
  }

  get activePagerQueryParams(): Params | null {
    return this.activeTab === 'person'
      ? this.personQueryParams
      : this.companyQueryParams;
  }

  get activePagerLabel(): string {
    return this.activeMetadata.pagerLabel;
  }

  get activeCreatePermission(): string {
    return this.activeMetadata.createPermission;
  }

  get activeCreateLink(): string[] {
    return [...this.activeMetadata.createLink];
  }

  get activeCreateLabel(): string {
    return this.activeMetadata.createLabel;
  }

  get activeTabTitle(): string {
    return this.activeMetadata.title;
  }

  get activeTabSubtitle(): string {
    return this.activeMetadata.subtitle;
  }

  get searchPlaceholder(): string {
    return this.activeMetadata.searchPlaceholder;
  }

  get emptyMessage(): string {
    return this.activeMetadata.emptyMessage;
  }

  protected switchTab(tab: ClientTab): void {
    if (this.activeTab === tab) {
      return;
    }
    const targetPage = this.getCurrentPage(tab);
    this.navigateToPage(targetPage, tab, this.getQueryParamsForTab(tab) ?? undefined);
  }

  protected goToPage(page: number): void {
    this.navigateToPage(
      page,
      this.activeTab,
      this.getQueryParamsForTab(this.activeTab) ?? undefined,
    );
  }

  protected applyFilters(): void {
    if (this.activeTab === 'person') {
      const filters = this.buildPersonFilters();
      if (this.areFiltersEmpty(filters as Record<string, unknown>)) {
        this.navigateToPage(0, 'person');
        return;
      }
      const queryParams = this.buildPersonQueryParams(filters);
      this.navigateToPage(0, 'person', queryParams ?? undefined);
      return;
    }

    const companyFilters = this.buildCompanyFilters();
    if (this.areFiltersEmpty(companyFilters as Record<string, unknown>)) {
      this.navigateToPage(0, 'company');
      return;
    }
    const queryParams = this.buildCompanyQueryParams(companyFilters);
    this.navigateToPage(0, 'company', queryParams ?? undefined);
  }

  protected clearFilters(): void {
    if (this.activeTab === 'person') {
      this.personFilters = this.createPersonFilterState();
      this.activePersonFilters = null;
      this.personQueryParams = null;
    } else {
      this.companyFilters = this.createCompanyFilterState();
      this.activeCompanyFilters = null;
      this.companyQueryParams = null;
    }
    this.navigateToPage(0, this.activeTab);
  }

  protected togglePersonStatus(person: Person): void {
    this.clientUiHelper.updatePersonStatus(
      person.id,
      !person.enabled,
      () => this.reloadTab('person'),
      `${person.firstName} ${person.lastName}`.trim(),
    );
  }

  protected toggleCompanyStatus(company: Company): void {
    this.clientUiHelper.updateCompanyStatus(
      company.id,
      !company.enabled,
      () => this.reloadTab('company'),
      company.companyName,
    );
  }

  private createInitialState<T extends ClientEntity>(): ClientListState<T> {
    return {
      items: [],
      pager: undefined,
      active: 0,
      inactive: 0,
      total: 0,
      loading: false,
      error: null,
    };
  }

  private parsePage(pageParam: string | null): number {
    if (!pageParam) {
      return 0;
    }
    const parsed = Number(pageParam);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  private normalizeTab(value: unknown): ClientTab {
    if (typeof value === 'string' && value.toLowerCase() === 'company') {
      return 'company';
    }
    return 'person';
  }

  private resetSearchState(): void {
    this.personFilters = this.createPersonFilterState();
    this.companyFilters = this.createCompanyFilterState();
    this.activePersonFilters = null;
    this.activeCompanyFilters = null;
    this.personQueryParams = null;
    this.companyQueryParams = null;
  }

  /**
   * Descarga la página de personas y delega el cálculo de contadores a
   * `loadClients` para evitar duplicar lógica entre tabs.
   *
   * @param page - Índice solicitado desde la ruta.
   * @param filters - Filtros aplicables cuando existen valores válidos.
   */
  private loadPersons(page: number, filters?: PersonSearchFilters): void {
    const activeFilters =
      filters && !this.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;
    this.loadClients<Person>({
      page,
      state: this.personState,
      type: 'person',
      fetchPager: (requestedPage) =>
        activeFilters
          ? this.personService.searchPaginated(requestedPage, activeFilters)
          : this.personService.getAllPaginated(requestedPage),
      fetchCounts: () => this.personService.getPersonCount(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('person', resolvedPage),
      errorMessage: 'Error al cargar las personas.',
      fallbackCounts: activeFilters
        ? undefined
        : () =>
            this.personService.getAll().pipe(
              map((persons) => ({
                ...this.computeCountsFromItems(persons),
                total: persons.length,
                items: persons,
              })),
            ),
    });
  }

  /**
   * Variante de `loadPersons` que apunta al catálogo de empresas.
   *
   * @param page - Índice solicitado para el tab de empresas.
   * @param filters - Filtros normalizados para empresas.
   */
  private loadCompanies(page: number, filters?: CompanySearchFilters): void {
    const activeFilters =
      filters && !this.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;
    this.loadClients<Company>({
      page,
      state: this.companyState,
      type: 'company',
      fetchPager: (requestedPage) =>
        activeFilters
          ? this.companyService.searchPaginated(requestedPage, activeFilters)
          : this.companyService.getAllPaginated(requestedPage),
      fetchCounts: () => this.companyService.getCompanyCount(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('company', resolvedPage),
      errorMessage: 'Error al cargar las empresas.',
      fallbackCounts: activeFilters
        ? undefined
        : () =>
            this.companyService.getAll().pipe(
              map((companies) => ({
                ...this.computeCountsFromItems(companies),
                total: companies.length,
                items: companies,
              })),
            ),
    });
  }

  /**
   * Núcleo del paginador: descarga simultáneamente la data y los contadores,
   * corrige los totales y activa un fallback con todo el dataset cuando la API
   * no proporciona cifras coherentes.
   *
   * @typeParam T - Entidad objetivo (persona o empresa).
   * @param config - Callbacks y metadatos necesarios para la carga.
   */
  private loadClients<T extends ClientEntity>(config: ClientLoadConfig<T>): void {
    const { state, page, fetchPager, fetchCounts, type, onPageResolved } =
      config;
    state.loading = true;
    state.error = null;

    const loader$ = forkJoin({
      pager: fetchPager(page),
      counts: fetchCounts(),
    })
      .pipe(finalize(() => (state.loading = false)))
      .subscribe({
        next: ({ pager, counts }) => {
          const items = pager.content ?? [];
          const pageCounts = this.computeCountsFromItems(items);
          state.items = items;
          state.pager = pager;

          const {
            active: activeCountFromApi,
            inactive: inactiveCountFromApi,
            hasCounts,
          } = this.extractCounts(counts, type);

          let activeCount = activeCountFromApi;
          let inactiveCount = inactiveCountFromApi;

          if (!hasCounts) {
            ({ active: activeCount, inactive: inactiveCount } = pageCounts);

            if (
              this.hasTotalElements(pager.totalElements) &&
              (items.length > 0 || Number(pager.numberOfElements) > 0)
            ) {
              const totalElements = Number(pager.totalElements);
              if (inactiveCount === 0 && activeCount <= totalElements) {
                inactiveCount = Math.max(totalElements - activeCount, 0);
              }
            }
          }

          const fallbackNeeded =
            !!config.fallbackCounts &&
            this.shouldFallbackToFullDataset({
              hasCounts,
              expectedActive: activeCount,
              expectedInactive: inactiveCount,
              pageCounts,
              reportedTotal: pager.totalElements,
            });

          state.active = activeCount;
          state.inactive = inactiveCount;
          state.total = this.resolveTotal(
            pager.totalElements,
            activeCount,
            inactiveCount,
            items.length,
          );
          onPageResolved(pager.number ?? page ?? 0);

          if (fallbackNeeded && config.fallbackCounts) {
            const fallback$ = config
              .fallbackCounts()
              .subscribe(
                ({ active, inactive, total, items: fallbackItems }) => {
                  state.active = active;
                  state.inactive = inactive;
                  state.total = total;

                  if (fallbackItems) {
                    const pageIndex = pager.number ?? page ?? 0;
                    const pageSize = this.resolvePageSize(
                      pager,
                      fallbackItems.length,
                    );
                    const pageItems = this.sliceItems(
                      fallbackItems,
                      pageIndex,
                      pageSize,
                    );

                    state.items = pageItems;
                    state.pager = this.mergePagerWithFallback(
                      pager,
                      pageItems,
                      total,
                      pageSize,
                      pageIndex,
                    );
                  }
                },
              );

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

  /**
   * Determina el total de registros priorizando el valor reportado y usando los
   * conteos locales como respaldo cuando la API no envía un número válido.
   *
   * @param totalElements - Total devuelto por la API (puede ser `undefined`).
   * @param active - Registros activos calculados.
   * @param inactive - Registros inactivos calculados.
   * @param fallbackLength - Conteo basado en los elementos locales.
   * @returns Total consistente para mostrar en los KPIs.
   */
  private resolveTotal(
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

  private hasTotalElements(value: number | undefined | null): value is number {
    const parsed = Number(value);
    return Number.isFinite(parsed);
  }

  /**
   * Decide si es necesario recalcular los totales a partir de todo el dataset
   * cuando los datos provenientes de la API están incompletos.
   *
   * @param context - Comparativo entre conteos esperados y reportados.
   * @returns Verdadero cuando conviene descargar todo para recalcular.
   */
  private shouldFallbackToFullDataset(context: {
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

  private resolvePageSize<T>(
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

  private sliceItems<T extends ClientEntity>(
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

  /**
   * Reconstruye la respuesta paginada una vez que se generaron datos de
   * fallback, manteniendo la semántica de paginación que espera la vista.
   *
   * @typeParam T - Entidad listada en la tabla.
   * @param pager - Respuesta original de la API (posiblemente incompleta).
   * @param pageItems - Elementos corregidos para la página actual.
   * @param totalElements - Total recalculado mediante fallback.
   * @param pageSize - Tamaño efectivo de página.
   * @param pageIndex - Página actual que se está mostrando.
   * @returns Nueva respuesta paginada consistente con los datos corregidos.
   */
  private mergePagerWithFallback<T extends ClientEntity>(
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

  private extractCounts(
    counts: unknown,
    type: ClientTab,
  ): {
    active: number;
    inactive: number;
    hasCounts: boolean;
  } {
    if (!counts || typeof counts !== 'object') {
      return { active: 0, inactive: 0, hasCounts: false };
    }

    const source = counts as Record<string, unknown>;
    const activeKeys =
      type === 'person'
        ? ['activeClients', 'activePersons', 'activePeople', 'active']
        : ['activeCompanies', 'activeClients', 'activeOrganizations', 'active'];
    const inactiveKeys =
      type === 'person'
        ? ['inactiveClients', 'inactivePersons', 'inactivePeople', 'inactive']
        : [
            'inactiveCompanies',
            'inactiveClients',
            'inactiveOrganizations',
            'inactive',
          ];

    const { value: activeValue, found: activeFound } = this.pickFirst(
      source,
      activeKeys,
    );
    const { value: inactiveValue, found: inactiveFound } = this.pickFirst(
      source,
      inactiveKeys,
    );

    const hasCounts = activeFound || inactiveFound;

    return {
      active: this.normalizeCount(activeValue),
      inactive: this.normalizeCount(inactiveValue),
      hasCounts,
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

  private updateDerivedCountsFromList(
    type: ClientTab,
    items: Array<ClientEntity>,
  ): void {
    const { active: enabledCount, inactive: disabledCount } =
      this.computeCountsFromItems(items);

    if (type === 'person') {
      this.personState.active = enabledCount;
      this.personState.inactive = disabledCount;
      this.personState.total = items.length;
      return;
    }

    this.companyState.active = enabledCount;
    this.companyState.inactive = disabledCount;
    this.companyState.total = items.length;
  }

  private computeCountsFromItems(items: Array<ClientEntity>): {
    active: number;
    inactive: number;
  } {
    const active = items.filter((item) => item.enabled).length;
    return {
      active,
      inactive: items.length - active,
    };
  }

  private getCurrentPage(type: ClientTab): number {
    return type === 'person' ? this.currentPersonPage : this.currentCompanyPage;
  }

  private setCurrentPage(type: ClientTab, page: number): void {
    if (type === 'person') {
      this.currentPersonPage = page;
    } else {
      this.currentCompanyPage = page;
    }
  }

  private reloadTab(type: ClientTab): void {
    const targetPage = this.getCurrentPage(type);
    if (type === 'person') {
      this.loadPersons(targetPage, this.activePersonFilters ?? undefined);
    } else {
      this.loadCompanies(targetPage, this.activeCompanyFilters ?? undefined);
    }
  }

  private navigateToPage(
    page: number,
    type: ClientTab,
    queryParams?: Params,
  ): void {
    const baseRoute = this.tabMetadata[type].routeBase;
    const commands = [...baseRoute, page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  /**
   * Reconstruye los filtros de personas a partir de los query params para
   * rehidratar formulario, filtros efectivos y querystring.
   *
   * @param map - Query params actuales aplicados al tab de personas.
   * @returns Estructura compuesta con filtros efectivos y estado de UI.
   */
  private extractPersonFiltersFromQuery(map: ParamMap): {
    filters: PersonSearchFilters | null;
    uiState: PersonSearchFilters & { enabled?: boolean | '' | 'true' | 'false' };
    queryParams: Params | null;
  } {
    const uiState = this.createPersonFilterState();
    const filters: PersonSearchFilters = {};

    const assign = (
      paramKey: string,
      targetKey: keyof PersonSearchFilters,
    ): void => {
      const value = map.get(paramKey);
      if (value) {
        (filters as Record<string, unknown>)[targetKey] = value;
        (uiState as Record<string, unknown>)[targetKey] = value;
      }
    };

    assign('personName', 'name');
    assign('personEmail', 'email');
    assign('personNationalId', 'nationalId');
    assign('personPhone', 'phoneNumber');
    assign('personCity', 'city');

    const enabledValue = map.get('personEnabled');
    if (enabledValue !== null) {
      filters.enabled = enabledValue === 'true';
      uiState.enabled = enabledValue === 'true' ? 'true' : 'false';
    }

    const hasFilters = !this.areFiltersEmpty(filters as Record<string, unknown>);
    return {
      filters: hasFilters ? filters : null,
      uiState,
      queryParams: hasFilters ? this.buildPersonQueryParams(filters) : null,
    };
  }

  /**
   * Versión para empresas que sincroniza formulario, filtros efectivos y URL.
   *
   * @param map - Query params activos en la ruta de empresas.
   * @returns Filtros construidos y estado para la vista.
   */
  private extractCompanyFiltersFromQuery(map: ParamMap): {
    filters: CompanySearchFilters | null;
    uiState: CompanySearchFilters & {
      enabled?: boolean | '' | 'true' | 'false';
    };
    queryParams: Params | null;
  } {
    const uiState = this.createCompanyFilterState();
    const filters: CompanySearchFilters = {};

    const assign = (
      paramKey: string,
      targetKey: keyof CompanySearchFilters,
    ): void => {
      const value = map.get(paramKey);
      if (value) {
        (filters as Record<string, unknown>)[targetKey] = value;
        (uiState as Record<string, unknown>)[targetKey] = value;
      }
    };

    assign('companyName', 'companyName');
    assign('companyTaxId', 'taxId');
    assign('companyEmail', 'email');
    assign('companyPhone', 'phoneNumber');
    assign('companyCity', 'city');

    const enabledValue = map.get('companyEnabled');
    if (enabledValue !== null) {
      filters.enabled = enabledValue === 'true';
      uiState.enabled = enabledValue === 'true' ? 'true' : 'false';
    }

    const hasFilters = !this.areFiltersEmpty(filters as Record<string, unknown>);
    return {
      filters: hasFilters ? filters : null,
      uiState,
      queryParams: hasFilters ? this.buildCompanyQueryParams(filters) : null,
    };
  }

  private createPersonFilterState(): PersonSearchFilters & {
    enabled?: boolean | '' | 'true' | 'false';
  } {
    return {
      name: '',
      email: '',
      nationalId: '',
      phoneNumber: '',
      city: '',
      enabled: '',
    };
  }

  private createCompanyFilterState(): CompanySearchFilters & {
    enabled?: boolean | '' | 'true' | 'false';
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

  private buildPersonFilters(): PersonSearchFilters {
    return {
      name: this.normalizeFilterValue(this.personFilters.name),
      email: this.normalizeFilterValue(this.personFilters.email),
      nationalId: this.normalizeFilterValue(this.personFilters.nationalId),
      phoneNumber: this.normalizeFilterValue(this.personFilters.phoneNumber),
      city: this.normalizeFilterValue(this.personFilters.city),
      enabled: this.normalizeStatus(this.personFilters.enabled),
    };
  }

  private buildCompanyFilters(): CompanySearchFilters {
    return {
      companyName: this.normalizeFilterValue(this.companyFilters.companyName),
      taxId: this.normalizeFilterValue(this.companyFilters.taxId),
      email: this.normalizeFilterValue(this.companyFilters.email),
      phoneNumber: this.normalizeFilterValue(this.companyFilters.phoneNumber),
      city: this.normalizeFilterValue(this.companyFilters.city),
      enabled: this.normalizeStatus(this.companyFilters.enabled),
    };
  }

  private buildPersonQueryParams(filters: PersonSearchFilters): Params | null {
    const params: Params = {};
    const assign = (key: string, value: string | undefined) => {
      if (value) {
        params[key] = value;
      }
    };

    assign('personName', filters.name);
    assign('personEmail', filters.email);
    assign('personNationalId', filters.nationalId);
    assign('personPhone', filters.phoneNumber);
    assign('personCity', filters.city);

    if (filters.enabled !== undefined) {
      params['personEnabled'] = String(filters.enabled);
    }

    return Object.keys(params).length ? params : null;
  }

  private buildCompanyQueryParams(filters: CompanySearchFilters): Params | null {
    const params: Params = {};
    const assign = (key: string, value: string | undefined) => {
      if (value) {
        params[key] = value;
      }
    };

    assign('companyName', filters.companyName);
    assign('companyTaxId', filters.taxId);
    assign('companyEmail', filters.email);
    assign('companyPhone', filters.phoneNumber);
    assign('companyCity', filters.city);

    if (filters.enabled !== undefined) {
      params['companyEnabled'] = String(filters.enabled);
    }

    return Object.keys(params).length ? params : null;
  }

  private normalizeFilterValue(value: string | undefined | null):
    | string
    | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private normalizeStatus(
    value: boolean | '' | 'true' | 'false' | undefined,
  ): boolean | undefined {
    if (value === '' || value === undefined) {
      return undefined;
    }
    return value === true || value === 'true';
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

  private getQueryParamsForTab(tab: ClientTab): Params | null {
    return tab === 'person' ? this.personQueryParams : this.companyQueryParams;
  }
}
