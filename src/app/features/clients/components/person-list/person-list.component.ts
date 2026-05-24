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
  PersonSearchFilters,
  PersonService,
} from '../../services/person.service';
import { Person } from '../../models/person.model';
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

const PERSON_FILTER_MAPPINGS: FilterFieldMapping[] = [
  { queryKey: 'personName', filterKey: 'name', type: 'string' },
  { queryKey: 'personEmail', filterKey: 'email', type: 'string' },
  { queryKey: 'personNationalId', filterKey: 'nationalId', type: 'string' },
  { queryKey: 'personPhone', filterKey: 'phoneNumber', type: 'string' },
  { queryKey: 'personCity', filterKey: 'city', type: 'string' },
  { queryKey: 'personEnabled', filterKey: 'enabled', type: 'boolean' },
];

/**
 * Sub-componente de listado de clientes personas naturales.
 * Incluye búsqueda por nombre, filtros avanzados (doc, email, teléfono, ciudad, estado)
 * y paginación sincronizada con los query params de la URL.
 * Es utilizado por `ClientListComponent` dentro de la pestaña "Personas".
 */
@Component({
  selector: 'app-person-list',
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
  templateUrl: './person-list.component.html',
  styleUrl: './person-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonListComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientUiHelper = inject(ClientUiHelperService);
  private readonly destroyRef = inject(DestroyRef);

  readonly listManager = new ListPageManager<Person>(this.destroyRef);

  filters: PersonSearchFilters & { enabled?: FilterEnabled } =
    this.createFilterState();

  private activeFilters: PersonSearchFilters | null = null;
  private queryParams: Params | null = null;

  readonly pagerUrl = '/clients/persons/page';
  readonly pagerLabel = 'personas';

  readonly enabledChipOptions: ChipOption[] = [
    { value: 'true', label: 'Activas' },
    { value: 'false', label: 'Inactivas' },
  ];

  protected get activeChips(): ActiveFilterChip[] {
    return buildActiveChips(
      this.filters,
      PERSON_FILTER_MAPPINGS,
      (filterKey, value) => {
        switch (filterKey) {
          case 'name':
            return null;
          case 'nationalId':
            return `Doc: ${value}`;
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
    if (this.filters.nationalId) count++;
    if (this.filters.email) count++;
    if (this.filters.phoneNumber) count++;
    if (this.filters.city) count++;
    if (this.filters.enabled) count++;
    return count;
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
          PersonSearchFilters & { enabled?: FilterEnabled }
        >(query, PERSON_FILTER_MAPPINGS, () => this.createFilterState());

        this.filters = filterInfo.uiState;
        this.activeFilters = filterInfo.filters;
        this.queryParams = filterInfo.queryParams;

        if (page < 0) {
          this.navigateToPage(0, filterInfo.queryParams ?? undefined);
          return;
        }

        this.loadPersons(page, this.activeFilters ?? undefined);
      });
  }

  protected onSearchValueChange(value: string): void {
    this.filters = { ...this.filters, name: value };
  }

  protected clearSearchTerm(): void {
    this.filters = { ...this.filters, name: '' };
    this.applyFilters();
  }

  protected removeFilter(filterKey: string): void {
    const defaults = this.createFilterState() as Record<string, unknown>;
    (this.filters as Record<string, unknown>)[filterKey] =
      defaults[filterKey] ?? '';
    this.applyFilters();
  }

  protected applyFilters(): void {
    const filters = this.buildFilters();
    if (ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)) {
      this.navigateToPage(0);
      return;
    }
    const qp = buildQueryParams(filters, PERSON_FILTER_MAPPINGS);
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
   * Solicita confirmación y cambia el estado habilitado/deshabilitado de la persona indicada.
   *
   * @param person - Persona cuyo estado se desea cambiar.
   */
  protected toggleStatus(person: Person): void {
    this.clientUiHelper.updatePersonStatus(
      person.id,
      !person.enabled,
      () =>
        this.loadPersons(
          this.listManager.currentPage(),
          this.activeFilters ?? undefined,
        ),
      `${person.firstName} ${person.lastName}`.trim(),
    );
  }

  private loadPersons(page: number, filters?: PersonSearchFilters): void {
    const activeFilters =
      filters &&
      !ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;

    this.listManager.loadPage(
      {
        fetchPager: (p) =>
          activeFilters
            ? this.personService.searchPaginated(p, activeFilters)
            : this.personService.getAllPaginated(p),
        fetchCounts: () => this.personService.getPersonCount(),
        errorMessage: 'Error al cargar las personas.',
        countKeys: {
          active: ['activeClients', 'activePersons', 'activePeople', 'active'],
          inactive: [
            'inactiveClients',
            'inactivePersons',
            'inactivePeople',
            'inactive',
          ],
        },
        computeCountsFn: ListPageManager.computeEnabledCounts,
        fallbackCounts: activeFilters
          ? undefined
          : () =>
              this.personService.getAll().pipe(
                map((persons) => ({
                  ...ListPageManager.computeEnabledCounts(persons),
                  total: persons.length,
                  items: persons,
                })),
              ),
      },
      page,
    );
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    const commands = ['/clients/persons/page', page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  private createFilterState(): PersonSearchFilters & {
    enabled?: FilterEnabled;
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

  private buildFilters(): PersonSearchFilters {
    const f = this.filters;
    return {
      name: ListPageManager.normalizeFilterValue(f.name),
      email: ListPageManager.normalizeFilterValue(f.email),
      nationalId: ListPageManager.normalizeFilterValue(f.nationalId),
      phoneNumber: ListPageManager.normalizeFilterValue(f.phoneNumber),
      city: ListPageManager.normalizeFilterValue(f.city),
      enabled: ListPageManager.normalizeStatus(f.enabled),
    };
  }
}
