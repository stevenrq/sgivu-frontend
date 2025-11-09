import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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

interface ClientSearchConfig<T extends ClientEntity, F> {
  state: ClientListState<T>;
  type: ClientTab;
  search: (filters: F) => Observable<T[]>;
  errorMessage: string;
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

  constructor(
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientUiHelper: ClientUiHelperService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      combineLatest([this.route.paramMap, this.route.data]).subscribe(
        ([params, data]) => {
          const requestedTab = this.normalizeTab(data['clientType']);
          const hasTabChanged = this.activeTab !== requestedTab;
          this.activeTab = requestedTab;

          const pageParam = params.get('page');
          const page = this.parsePage(pageParam);

          if (hasTabChanged) {
            this.resetSearchState();
          }

          if (page < 0) {
            this.navigateToPage(0, this.activeTab);
            return;
          }

          if (this.activeTab === 'person') {
            this.loadPersons(page);
          } else {
            this.loadCompanies(page);
          }
        },
      ),
    );
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
    this.navigateToPage(targetPage, tab);
  }

  protected goToPage(page: number): void {
    this.navigateToPage(page, this.activeTab);
  }

  protected applyFilters(): void {
    if (this.activeTab === 'person') {
      const filters = this.buildPersonFilters();
      if (this.areFiltersEmpty(filters as Record<string, unknown>)) {
        this.reloadTab('person');
        return;
      }
      this.searchPersons(filters);
      return;
    }

    const companyFilters = this.buildCompanyFilters();
    if (this.areFiltersEmpty(companyFilters as Record<string, unknown>)) {
      this.reloadTab('company');
      return;
    }
    this.searchCompanies(companyFilters);
  }

  protected clearFilters(): void {
    if (this.activeTab === 'person') {
      this.personFilters = this.createPersonFilterState();
    } else {
      this.companyFilters = this.createCompanyFilterState();
    }
    this.reloadTab(this.activeTab);
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
  }

  private loadPersons(page: number): void {
    this.loadClients<Person>({
      page,
      state: this.personState,
      type: 'person',
      fetchPager: (requestedPage) =>
        this.personService.getAllPaginated(requestedPage),
      fetchCounts: () => this.personService.getPersonCount(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('person', resolvedPage),
      errorMessage: 'Error al cargar las personas.',
      fallbackCounts: () =>
        this.personService.getAll().pipe(
          map((persons) => ({
            ...this.computeCountsFromItems(persons),
            total: persons.length,
            items: persons,
          })),
        ),
    });
  }

  private loadCompanies(page: number): void {
    this.loadClients<Company>({
      page,
      state: this.companyState,
      type: 'company',
      fetchPager: (requestedPage) =>
        this.companyService.getAllPaginated(requestedPage),
      fetchCounts: () => this.companyService.getCompanyCount(),
      onPageResolved: (resolvedPage) =>
        this.setCurrentPage('company', resolvedPage),
      errorMessage: 'Error al cargar las empresas.',
      fallbackCounts: () =>
        this.companyService.getAll().pipe(
          map((companies) => ({
            ...this.computeCountsFromItems(companies),
            total: companies.length,
            items: companies,
          })),
        ),
    });
  }

  private loadClients<T extends ClientEntity>(
    config: ClientLoadConfig<T>,
  ): void {
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

  private searchPersons(filters: PersonSearchFilters): void {
    this.searchClients<Person, PersonSearchFilters>(filters, {
      state: this.personState,
      type: 'person',
      search: (params) => this.personService.search(params),
      errorMessage: 'Error al buscar personas.',
    });
  }

  private searchCompanies(filters: CompanySearchFilters): void {
    this.searchClients<Company, CompanySearchFilters>(filters, {
      state: this.companyState,
      type: 'company',
      search: (params) => this.companyService.search(params),
      errorMessage: 'Error al buscar empresas.',
    });
  }

  private searchClients<T extends ClientEntity, F>(
    filters: F,
    config: ClientSearchConfig<T, F>,
  ): void {
    const { state, type, search, errorMessage } = config;
    state.loading = true;
    state.error = null;

    const search$ = search(filters)
      .pipe(finalize(() => (state.loading = false)))
      .subscribe({
        next: (items) => {
          state.items = items;
          state.pager = undefined;
          this.updateDerivedCountsFromList(type, items);
        },
        error: (err) => {
          console.error(err);
          state.error = errorMessage;
        },
      });

    this.subscriptions.push(search$);
  }

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
      this.loadPersons(targetPage);
    } else {
      this.loadCompanies(targetPage);
    }
  }

  private navigateToPage(page: number, type: ClientTab): void {
    const baseRoute = this.tabMetadata[type].routeBase;
    void this.router.navigate([...baseRoute, page]);
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
}
