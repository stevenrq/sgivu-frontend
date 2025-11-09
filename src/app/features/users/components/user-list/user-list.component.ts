import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription, finalize, forkJoin } from 'rxjs';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { UserSearchFilters, UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

interface UserListState<T extends User> {
  items: T[];
  pager?: PaginatedResponse<T>;
  active: number;
  inactive: number;
  total: number;
  loading: boolean;
  error: string | null;
}

interface UserLoadConfig<T extends User> {
  page: number;
  state: UserListState<T>;
  fetchPager: (page: number) => Observable<PaginatedResponse<T>>;
  fetchCounts: () => Observable<unknown>;
  onPageResolved: (page: number) => void;
  errorMessage: string;
}

interface UserSearchConfig<T extends User> {
  state: UserListState<T>;
  search: (filters: UserSearchFilters) => Observable<T[]>;
  errorMessage: string;
}

interface UserListMetadata {
  pagerUrl: string[];
  title: string;
  subtitle: string;
  createPermission: string;
  createLink: string[];
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
}

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    FormsModule,
    PagerComponent,
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit, OnDestroy {
  readonly searchTermMaxLength = 80;

  filters: UserSearchFilters & { enabled?: boolean | '' } = {
    name: '',
    username: '',
    email: '',
    role: '',
    enabled: '',
  };

  readonly roleOptions: string[] = ['ADMIN', 'MANAGER', 'SALE', 'PURCHASE', 'USER'];

  private readonly metadata: UserListMetadata = {
    pagerUrl: ['/users/page'],
    title: 'Usuarios registrados',
    subtitle:
      'Administra las cuentas de usuario, roles y permisos del sistema.',
    createPermission: 'user:create',
    createLink: ['/users/create'],
    createLabel: 'Crear Usuario',
    searchPlaceholder: 'Buscar usuarios...',
    emptyMessage: 'No existen usuarios registrados en este momento.',
  };

  private readonly userState = this.createInitialState<User>();
  private readonly subscriptions: Subscription[] = [];
  private currentPage = 0;

  constructor(
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userUiHelper: UserUiHelperService,
  ) {}

  ngOnInit(): void {
    const routeSub = this.route.paramMap.subscribe((params) => {
      const pageParam = params.get('page');
      const page = this.parsePage(pageParam);

      if (page < 0) {
        this.navigateToPage(0);
        return;
      }

      this.loadUsers(page);
    });

    this.subscriptions.push(routeSub);
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  get users(): User[] {
    return this.userState.items;
  }

  get pager(): PaginatedResponse<User> | undefined {
    return this.userState.pager;
  }

  get totalUsers(): number {
    return this.userState.total;
  }

  get activeUsers(): number {
    return this.userState.active;
  }

  get inactiveUsers(): number {
    return this.userState.inactive;
  }

  get isLoading(): boolean {
    return this.userState.loading;
  }

  get error(): string | null {
    return this.userState.error;
  }

  get title(): string {
    return this.metadata.title;
  }

  get subtitle(): string {
    return this.metadata.subtitle;
  }

  get createLink(): string[] {
    return [...this.metadata.createLink];
  }

  get createPermission(): string {
    return this.metadata.createPermission;
  }

  get createLabel(): string {
    return this.metadata.createLabel;
  }

  get searchPlaceholder(): string {
    return this.metadata.searchPlaceholder;
  }

  get pagerUrl(): string {
    return this.metadata.pagerUrl.join('/');
  }

  get emptyMessage(): string {
    return this.metadata.emptyMessage;
  }

  protected search(): void {
    this.performSearch();
  }

  protected reset(): void {
    this.filters = {
      name: '',
      username: '',
      email: '',
      role: '',
      enabled: '',
    };
    this.reloadCurrentPage();
  }

  public updateStatus(id: number, status: boolean): void {
    this.userUiHelper.updateStatus(id, status, () => this.reloadCurrentPage());
  }

  private loadUsers(page: number): void {
    this.loadEntities<User>({
      page,
      state: this.userState,
      fetchPager: (requestedPage) =>
        this.userService.getAllPaginated(requestedPage),
      fetchCounts: () => this.userService.getUserCount(),
      onPageResolved: (resolvedPage) => this.setCurrentPage(resolvedPage),
      errorMessage: 'Error al cargar usuarios.',
    });
  }

  private loadEntities<T extends User>(config: UserLoadConfig<T>): void {
    const { state, page, fetchPager, fetchCounts, onPageResolved } = config;
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
          state.items = items;
          state.pager = pager;

          const { active, inactive } = this.extractCounts(counts);

          state.active = active;
          state.inactive = inactive;
          state.total = this.resolveTotal(
            pager.totalElements,
            active,
            inactive,
            items.length,
          );
          onPageResolved(pager.number ?? page ?? 0);
        },
        error: (err) => {
          console.error(err);
          state.error = config.errorMessage;
          state.items = [];
          state.pager = undefined;
          state.active = 0;
          state.inactive = 0;
          state.total = 0;
        },
      });

    this.subscriptions.push(loader$);
  }

  private performSearch(): void {
    const activeFilters = this.buildActiveFilters();
    if (this.areFiltersEmpty(activeFilters)) {
      this.reloadCurrentPage();
      return;
    }

    this.searchEntities<User>(activeFilters, {
      state: this.userState,
      search: (query) => this.userService.searchUsers(query),
      errorMessage: 'Error al buscar usuarios.',
    });
  }

  private buildActiveFilters(): UserSearchFilters {
    return {
      name: this.filters.name?.trim().slice(0, this.searchTermMaxLength),
      username: this.filters.username?.trim(),
      email: this.filters.email?.trim(),
      role: this.filters.role || undefined,
      enabled:
        this.filters.enabled === '' ? undefined : Boolean(this.filters.enabled),
    };
  }

  private areFiltersEmpty(filters: UserSearchFilters): boolean {
    return (
      !filters.name &&
      !filters.username &&
      !filters.email &&
      !filters.role &&
      filters.enabled === undefined
    );
  }

  private searchEntities<T extends User>(
    filters: UserSearchFilters,
    config: UserSearchConfig<T>,
  ): void {
    const { state, search, errorMessage } = config;
    state.loading = true;
    state.error = null;

    const search$ = search(filters)
      .pipe(finalize(() => (state.loading = false)))
      .subscribe({
        next: (items) => {
          state.items = items;
          state.pager = undefined;
          this.updateDerivedCountsFromList(items);
        },
        error: (err) => {
          console.error(err);
          state.error = errorMessage;
        },
      });

    this.subscriptions.push(search$);
  }

  private updateDerivedCountsFromList(items: User[]): void {
    const { active, inactive } = this.computeCountsFromItems(items);
    this.userState.active = active;
    this.userState.inactive = inactive;
    this.userState.total = items.length;
  }

  private computeCountsFromItems(items: User[]): {
    active: number;
    inactive: number;
  } {
    const active = items.filter((item) => item.enabled).length;
    return {
      active,
      inactive: items.length - active,
    };
  }

  private extractCounts(counts: unknown): { active: number; inactive: number } {
    if (!counts || typeof counts !== 'object') {
      return { active: 0, inactive: 0 };
    }

    const source = counts as Record<string, unknown>;
    return {
      active: this.normalizeCount(source['activeUsers']),
      inactive: this.normalizeCount(source['inactiveUsers']),
    };
  }

  private normalizeCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

  private createInitialState<T extends User>(): UserListState<T> {
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

  private setCurrentPage(page: number): void {
    this.currentPage = page;
  }

  private reloadCurrentPage(): void {
    this.loadUsers(this.currentPage);
  }

  private navigateToPage(page: number): void {
    void this.router.navigate([...this.metadata.pagerUrl, page]);
  }
}
