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
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserSearchFilters, UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';
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

type FilterEnabled = '' | 'true' | 'false';

const USER_FILTER_MAPPINGS: FilterFieldMapping[] = [
  { queryKey: 'userName', filterKey: 'name', type: 'string' },
  { queryKey: 'userUsername', filterKey: 'username', type: 'string' },
  { queryKey: 'userEmail', filterKey: 'email', type: 'string' },
  { queryKey: 'userRole', filterKey: 'role', type: 'string' },
  { queryKey: 'userEnabled', filterKey: 'enabled', type: 'boolean' },
];

/**
 * Componente de listado de usuarios con búsqueda rápida, filtros avanzados y paginación.
 * Sincroniza el estado de filtros y página con los query params de la URL para
 * permitir navegación directa y recarga sin perder el contexto de búsqueda.
 *
 * @see {@link ListPageManager} para la gestión del estado paginado.
 * @see {@link UserUiHelperService} para los diálogos de cambio de estado.
 */
@Component({
  selector: 'app-user-list',
  imports: [
    NgClass,
    FormsModule,
    PagerComponent,
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
    RowNavigateDirective,
    QuickSearchBarComponent,
    FilterChipGroupComponent,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userUiHelper = inject(UserUiHelperService);
  private readonly destroyRef = inject(DestroyRef);

  readonly listManager = new ListPageManager<User>(this.destroyRef);

  readonly pagerUrl = '/users/page';
  readonly title = 'Usuarios registrados';
  readonly subtitle =
    'Administra las cuentas de usuario, roles y permisos del sistema.';
  readonly createLabel = 'Crear Usuario';
  readonly emptyMessage = 'No existen usuarios registrados en este momento.';

  readonly roleChipOptions: ChipOption[] = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'SALE', label: 'Ventas' },
    { value: 'PURCHASE', label: 'Compras' },
    { value: 'USER', label: 'Usuario' },
  ];

  readonly enabledChipOptions: ChipOption[] = [
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
  ];

  filters: UserSearchFilters & { enabled?: FilterEnabled } =
    this.createFilterState();

  private activeFilters: UserSearchFilters | null = null;
  private queryParams: Params | null = null;

  get activePagerQueryParams(): Params | null {
    return this.queryParams;
  }

  /** Chips que representan los filtros avanzados activos (excluye el término de nombre). */
  protected get activeChips(): ActiveFilterChip[] {
    return buildActiveChips(
      this.filters,
      USER_FILTER_MAPPINGS,
      (filterKey, value) => {
        switch (filterKey) {
          case 'name':
            return null;
          case 'username':
            return `Usuario: ${value}`;
          case 'email':
            return `Email: ${value}`;
          case 'role':
            return `Rol: ${value}`;
          case 'enabled':
            return value === 'true' || value === true
              ? 'Estado: Activo'
              : 'Estado: Inactivo';
          default:
            return null;
        }
      },
    );
  }

  /** Número de filtros avanzados activos para el badge del botón "Más filtros". */
  protected showAdvancedFilters = false;

  protected get advancedFiltersCount(): number {
    let count = 0;
    if (this.filters.username) count++;
    if (this.filters.email) count++;
    if (this.filters.role) count++;
    if (this.filters.enabled) count++;
    return count;
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const page = ListPageManager.parsePage(params.get('page'));
        const filterInfo = extractFiltersFromQuery<
          UserSearchFilters & { enabled?: FilterEnabled }
        >(query, USER_FILTER_MAPPINGS, () => this.createFilterState());

        this.filters = filterInfo.uiState;
        this.activeFilters = filterInfo.filters;
        this.queryParams = filterInfo.queryParams;

        if (page < 0) {
          this.navigateToPage(0, filterInfo.queryParams ?? undefined);
          return;
        }

        this.loadUsers(page, this.activeFilters ?? undefined);
      });
  }

  protected onSearchValueChange(value: string): void {
    this.filters = { ...this.filters, name: value };
  }

  protected applyFilters(): void {
    const filters = this.buildFilters();
    if (ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)) {
      this.navigateToPage(0);
      return;
    }
    const qp = buildQueryParams(filters, USER_FILTER_MAPPINGS);
    this.navigateToPage(0, qp ?? undefined);
  }

  protected clearFilters(): void {
    this.filters = this.createFilterState();
    this.activeFilters = null;
    this.queryParams = null;
    this.navigateToPage(0);
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

  /**
   * Solicita confirmación y cambia el estado habilitado/deshabilitado de un usuario.
   * Recarga la página actual tras la operación exitosa.
   *
   * @param id - Identificador del usuario.
   * @param status - Estado actual del usuario (`true` = activo).
   */
  updateStatus(id: number, status: boolean): void {
    this.userUiHelper.updateStatus(id, status, () =>
      this.loadUsers(
        this.listManager.currentPage(),
        this.activeFilters ?? undefined,
      ),
    );
  }

  private loadUsers(page: number, filters?: UserSearchFilters): void {
    const activeFilters =
      filters &&
      !ListPageManager.areFiltersEmpty(filters as Record<string, unknown>)
        ? filters
        : undefined;

    this.listManager.loadPage(
      {
        fetchPager: (p) =>
          activeFilters
            ? this.userService.searchUsersPaginated(p, activeFilters)
            : this.userService.getAllPaginated(p),
        fetchCounts: () => this.userService.getUserCount(),
        errorMessage: 'Error al cargar usuarios.',
        countKeys: {
          active: ['activeUsers', 'active'],
          inactive: ['inactiveUsers', 'inactive'],
        },
        computeCountsFn: ListPageManager.computeEnabledCounts,
        fallbackCounts: activeFilters
          ? undefined
          : () =>
              this.userService.getAll().pipe(
                map((users) => ({
                  ...ListPageManager.computeEnabledCounts(users),
                  total: users.length,
                  items: users,
                })),
              ),
      },
      page,
    );
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    const commands = ['/users/page', page];
    if (queryParams) {
      void this.router.navigate(commands, { queryParams });
    } else {
      void this.router.navigate(commands);
    }
  }

  private createFilterState(): UserSearchFilters & { enabled?: FilterEnabled } {
    return {
      name: '',
      username: '',
      email: '',
      role: '',
      enabled: '',
    };
  }

  private buildFilters(): UserSearchFilters {
    const f = this.filters;
    return {
      name: ListPageManager.normalizeFilterValue(f.name),
      username: ListPageManager.normalizeFilterValue(f.username),
      email: ListPageManager.normalizeFilterValue(f.email),
      role: ListPageManager.normalizeFilterValue(f.role),
      enabled: ListPageManager.normalizeStatus(
        f.enabled as '' | 'true' | 'false',
      ),
    };
  }
}
