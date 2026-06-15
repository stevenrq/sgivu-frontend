import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, finalize } from 'rxjs';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { showHttpError } from '../../../../shared/utils/error-handler.utils';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';
import {
  PurchaseSaleSearchFilters,
  PurchaseSaleService,
} from '../../services/purchase-sale.service';
import { PurchaseSale } from '../../models/purchase-sale.model';
import { ContractType } from '../../models/contract-type.enum';
import { ContractStatus } from '../../models/contract-status.enum';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { RowNavigateDirective } from '../../../../shared/directives/row-navigate.directive';
import { PurchaseSaleLookupService } from '../../services/purchase-sale-lookup.service';
import {
  ExportFormat,
  PurchaseSaleReportService,
} from '../../services/purchase-sale-report.service';
import {
  getContractTypeLabel,
  getPaymentMethodLabel,
  getStatusBadgeClass,
  getStatusLabel,
  getVehicleBadgeClass,
} from '../../models/contract-labels';
import {
  CONTRACT_STATUS_CHIP_OPTIONS,
  CONTRACT_TYPE_CHIP_OPTIONS,
  PAYMENT_METHOD_CHIP_OPTIONS,
} from '../../utils/purchase-sale-filter.utils';
import * as psDisplay from '../../utils/purchase-sale-display.utils';
import {
  PurchaseSaleActionContext,
  PurchaseSaleUiHelperService,
} from '../../services/purchase-sale-ui-helper.service';
import { QuickSuggestion } from '../../utils/quick-search.utils';
import { ListToolbarComponent } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { FilterChipGroupComponent } from '../../../../shared/components/filter-chip-group/filter-chip-group.component';
import { RangeInputComponent } from '../../../../shared/components/range-input/range-input.component';
import { PurchaseSaleListManager } from '../../utils/purchase-sale-list-manager';

interface PurchaseSaleListState {
  items: PurchaseSale[];
  pager?: PaginatedResponse<PurchaseSale>;
  loading: boolean;
  error: string | null;
}

/**
 * Listado paginado de contratos de compra-venta con búsqueda rápida, filtros
 * avanzados y descarga de reportes. La lógica de filtros y sugerencias rápidas
 * vive en PurchaseSaleListManager; este componente orquesta la carga de datos
 * y las acciones sobre contratos.
 */
@Component({
  selector: 'app-purchase-sale-list',
  imports: [
    NgClass,
    FormsModule,
    HasPermissionDirective,
    PagerComponent,
    UtcToGmtMinus5Pipe,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
    CopCurrencyPipe,
    RouterLink,
    RowNavigateDirective,
    ListToolbarComponent,
    FilterChipGroupComponent,
    RangeInputComponent,
  ],
  providers: [PurchaseSaleListManager],
  templateUrl: './purchase-sale-list.component.html',
  styleUrl: './purchase-sale-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseSaleListComponent implements OnInit {
  protected readonly listManager = inject(PurchaseSaleListManager);
  readonly lookupService = inject(PurchaseSaleLookupService);
  readonly reportService = inject(PurchaseSaleReportService);
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly uiHelper = inject(PurchaseSaleUiHelperService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly ContractStatus = ContractStatus;
  readonly ContractType = ContractType;
  readonly contractTypeChipOptions = CONTRACT_TYPE_CHIP_OPTIONS;
  readonly contractStatusChipOptions = CONTRACT_STATUS_CHIP_OPTIONS;
  readonly paymentMethodChipOptions = PAYMENT_METHOD_CHIP_OPTIONS;
  readonly getStatusLabel = getStatusLabel;
  readonly getContractTypeLabel = getContractTypeLabel;
  readonly getPaymentMethodLabel = getPaymentMethodLabel;
  readonly getStatusBadgeClass = getStatusBadgeClass;
  readonly getVehicleBadgeClass = getVehicleBadgeClass;

  // Delegate signals from manager so the template keeps the same bindings
  readonly filters = this.listManager.filters;
  readonly quickSuggestions = this.listManager.quickSuggestions;
  readonly pagerQueryParams = this.listManager.pagerQueryParams;
  readonly pagerUrl = '/purchase-sales/page';

  protected get activeChips() {
    return this.listManager.activeChips();
  }
  protected get advancedFiltersCount() {
    return this.listManager.advancedFiltersCount();
  }

  readonly summaryState = signal({ total: 0, purchases: 0, sales: 0 });
  readonly reportStartDate = signal<string | null>(null);
  readonly reportEndDate = signal<string | null>(null);
  readonly listState = signal<PurchaseSaleListState>({
    items: [],
    loading: false,
    error: null,
  });

  private currentPage = 0;
  private activeSearchFilters: PurchaseSaleSearchFilters | null = null;

  ngOnInit(): void {
    this.lookupService.loadAll(this.destroyRef, (err) =>
      this.handleError(err, 'cargar la información auxiliar'),
    );

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const pageParam = params.get('page');
        const requiredPage = pageParam ? Number(pageParam) : 0;
        if (Number.isNaN(requiredPage) || requiredPage < 0) {
          this.listManager.navigateToFirstPagePreservingQuery(query);
          return;
        }
        const { requestFilters } = this.listManager.parseQuery(query);
        this.activeSearchFilters = requestFilters;
        this.loadContracts(requiredPage, requestFilters ?? undefined);
      });

    this.refreshSummary();
  }

  get pager() {
    return this.listState().pager;
  }
  get isListLoading() {
    return this.listState().loading;
  }
  get listError() {
    return this.listState().error;
  }
  get contracts() {
    return this.listState().items;
  }
  get totalContracts() {
    return this.summaryState().total;
  }
  get totalPurchases() {
    return this.summaryState().purchases;
  }
  get totalSales() {
    return this.summaryState().sales;
  }

  getClientLabel(c: PurchaseSale) {
    return psDisplay.getClientLabel(c, this.lookupService.clientMap());
  }
  getUserLabel(c: PurchaseSale) {
    return psDisplay.getUserLabel(c, this.lookupService.userMap());
  }
  getVehicleLabel(c: PurchaseSale) {
    return psDisplay.getVehicleLabel(c, this.lookupService.vehicleMap());
  }
  getPurchaseDate(c: PurchaseSale) {
    return psDisplay.getPurchaseDate(c, this.lookupService.vehicleMap());
  }
  getSaleDate(c: PurchaseSale) {
    return psDisplay.getSaleDate(c, this.lookupService.vehicleMap());
  }

  navigateToCreate(): void {
    void this.router.navigate(['/purchase-sales/register']);
  }
  resetReportDates(): void {
    this.reportStartDate.set(null);
    this.reportEndDate.set(null);
  }
  downloadReport(format: ExportFormat): void {
    this.reportService.download(
      format,
      this.destroyRef,
      this.reportStartDate(),
      this.reportEndDate(),
    );
  }

  // Filter delegate methods — keep same names so the template stays unchanged
  protected applyFilters(): void {
    this.listManager.applyFilters();
  }
  clearFilters(): void {
    this.listManager.clearFilters();
  }
  resetFilters(): void {
    this.listManager.clearFilters();
  }
  protected patchFilters(
    patch: Parameters<PurchaseSaleListManager['patchFilters']>[0],
  ): void {
    this.listManager.patchFilters(patch);
  }
  protected removeFilter(key: string): void {
    this.listManager.removeFilter(key);
  }
  protected onSearchValueChange(value: string): void {
    this.listManager.onSearchValueChange(value);
  }
  protected clearSearchTerm(): void {
    this.listManager.clearSearchTerm();
  }
  selectQuickSuggestion(suggestion: QuickSuggestion): void {
    this.listManager.selectQuickSuggestion(suggestion);
  }
  protected numToFilterStr(value: number | null): string {
    return value !== null ? String(value) : '';
  }

  deleteContract(contract: PurchaseSale): void {
    this.uiHelper.delete(contract, this.buildActionContext());
  }
  updateStatus(contract: PurchaseSale, status: ContractStatus): void {
    this.uiHelper.updateStatus(contract, status, {
      ...this.buildActionContext(),
      onSuccess: () => {
        this.reloadCurrentPage();
        this.refreshSummary();
      },
    });
  }

  private buildActionContext(): PurchaseSaleActionContext {
    return {
      destroyRef: this.destroyRef,
      decorateMessage: (msg) => this.decorateVehicleMessage(msg),
      onSuccess: () => this.reloadCurrentPage(),
    };
  }

  private reloadCurrentPage(): void {
    this.loadContracts(this.currentPage, this.activeSearchFilters ?? undefined);
  }

  private loadContracts(
    page: number,
    filters?: PurchaseSaleSearchFilters,
  ): void {
    this.listState.update((s) => ({ ...s, loading: true, error: null }));
    const request$ = filters
      ? this.purchaseSaleService.searchPaginated({ ...filters, page, size: 10 })
      : this.purchaseSaleService.getAllPaginated(page);
    request$
      .pipe(
        finalize(() =>
          this.listState.update((s) => ({ ...s, loading: false })),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (pager) => {
          this.listState.update((s) => ({ ...s, items: pager.content, pager }));
          this.currentPage = pager.number;
        },
        error: (error) => {
          this.listState.update((s) => ({
            ...s,
            error: 'No se pudieron cargar los contratos de compra/venta.',
          }));
          this.handleError(error, 'cargar los contratos', false);
        },
      });
  }

  private refreshSummary(): void {
    this.purchaseSaleService
      .getAllSimple()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contracts) => {
          const purchases = contracts.filter(
            (c) => c.contractType === ContractType.PURCHASE,
          ).length;
          const sales = contracts.filter(
            (c) => c.contractType === ContractType.SALE,
          ).length;
          this.summaryState.set({ total: contracts.length, purchases, sales });
          this.listManager.updateLinkedEntities(contracts);
        },
        error: () => {
          this.summaryState.set({ total: 0, purchases: 0, sales: 0 });
          this.listManager.updateLinkedEntities([]);
        },
      });
  }

  private handleError(
    error: unknown,
    action: string,
    displayAlert = true,
  ): void {
    if (displayAlert) {
      showHttpError(error, action, (msg) => this.decorateVehicleMessage(msg));
    }
  }

  private decorateVehicleMessage(message: string | null): string {
    return psDisplay.decorateVehicleMessage(
      message,
      this.lookupService.vehicleMap(),
    );
  }
}
