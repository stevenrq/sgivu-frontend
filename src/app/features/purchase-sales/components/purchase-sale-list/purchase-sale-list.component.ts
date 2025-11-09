import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { Subscription, combineLatest, finalize, forkJoin, map, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';
import {
  PurchaseSaleSearchFilters,
  PurchaseSaleService,
} from '../../services/purchase-sale.service';
import { PurchaseSale } from '../../models/purchase-sale.model';
import { ContractType } from '../../models/contract-type.enum';
import { ContractStatus } from '../../models/contract-status.enum';
import { PaymentMethod } from '../../models/payment-method.enum';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { PersonService } from '../../../clients/services/person.service';
import { CompanyService } from '../../../clients/services/company.service';
import { UserService } from '../../../users/services/user.service';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import {
  ClientOption,
  UserOption,
  VehicleOption,
  mapCarsToVehicles,
  mapCompaniesToClients,
  mapMotorcyclesToVehicles,
  mapPersonsToClients,
  mapUsersToOptions,
} from '../../models/purchase-sale-reference.model';

interface PurchaseSaleListState {
  items: PurchaseSale[];
  pager?: PaginatedResponse<PurchaseSale>;
  loading: boolean;
  error: string | null;
}

type ContractTypeFilter = ContractType | 'ALL';
type ContractStatusFilter = ContractStatus | 'ALL';

type PurchaseSaleUiFilters = {
  contractType: ContractTypeFilter;
  contractStatus: ContractStatusFilter;
  clientId: string;
  userId: string;
  vehicleId: string;
  paymentMethod: string;
  term: string;
  minPurchasePrice: string;
  maxPurchasePrice: string;
  minSalePrice: string;
  maxSalePrice: string;
};

@Component({
  selector: 'app-purchase-sale-list',
  imports: [
    CommonModule,
    FormsModule,
    HasPermissionDirective,
    PagerComponent,
    UtcToGmtMinus5Pipe,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
  ],
  templateUrl: './purchase-sale-list.component.html',
  styleUrl: './purchase-sale-list.component.css',
})
export class PurchaseSaleListComponent implements OnInit, OnDestroy {
  readonly contractStatuses = Object.values(ContractStatus);
  readonly contractTypes = Object.values(ContractType);
  readonly ContractStatus = ContractStatus;
  readonly ContractType = ContractType;
  readonly paymentMethods = Object.values(PaymentMethod);

  readonly clients: WritableSignal<ClientOption[]> = signal<ClientOption[]>([]);
  readonly users: WritableSignal<UserOption[]> = signal<UserOption[]>([]);
  readonly vehicles: WritableSignal<VehicleOption[]> = signal<VehicleOption[]>(
    [],
  );

  readonly clientMap = computed(
    () =>
      new Map<number, ClientOption>(
        this.clients().map((client) => [client.id, client]),
      ),
  );

  readonly userMap = computed(
    () =>
      new Map<number, UserOption>(this.users().map((user) => [user.id, user])),
  );

  readonly vehicleMap = computed(
    () =>
      new Map<number, VehicleOption>(
        this.vehicles().map((vehicle) => [vehicle.id, vehicle]),
      ),
  );

  readonly summaryState = signal({
    total: 0,
    purchases: 0,
    sales: 0,
  });

  filters: PurchaseSaleUiFilters = this.getDefaultUiFilters();

  reportStartDate: string | null = null;
  reportEndDate: string | null = null;
  exportLoading: Record<'pdf' | 'excel' | 'csv', boolean> = {
    pdf: false,
    excel: false,
    csv: false,
  };

  listState: PurchaseSaleListState = {
    items: [],
    loading: false,
    error: null,
  };

  private currentPage = 0;
  private readonly subscriptions: Subscription[] = [];
  private activeSearchFilters: PurchaseSaleSearchFilters | null = null;
  pagerQueryParams: Params | null = null;
  private readonly statusLabels: Record<ContractStatus, string> = {
    [ContractStatus.PENDING]: 'Pendiente',
    [ContractStatus.ACTIVE]: 'Activo',
    [ContractStatus.COMPLETED]: 'Completado',
    [ContractStatus.CANCELED]: 'Cancelado',
  };

  private readonly typeLabels: Record<ContractType, string> = {
    [ContractType.PURCHASE]: 'Compra',
    [ContractType.SALE]: 'Venta',
  };

  private readonly paymentMethodLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: 'Efectivo',
    [PaymentMethod.BANK_TRANSFER]: 'Transferencia bancaria',
    [PaymentMethod.BANK_DEPOSIT]: 'Consignación bancaria',
    [PaymentMethod.CASHIERS_CHECK]: 'Cheque de gerencia',
    [PaymentMethod.MIXED]: 'Pago combinado',
    [PaymentMethod.FINANCING]: 'Financiación',
    [PaymentMethod.DIGITAL_WALLET]: 'Billetera digital',
    [PaymentMethod.TRADE_IN]: 'Permuta',
    [PaymentMethod.INSTALLMENT_PAYMENT]: 'Pago a plazos',
  };

  constructor(
    private readonly purchaseSaleService: PurchaseSaleService,
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    const routeSub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).subscribe(([params, query]) => {
      const pageParam = params.get('page');
      const requiredPage = this.parsePage(pageParam);
      if (Number.isNaN(requiredPage) || requiredPage < 0) {
        this.navigateToPage(0, this.paramMapToObject(query) ?? undefined);
        return;
      }

      const {
        uiFilters,
        requestFilters,
        queryParams: pagerParams,
      } = this.extractFiltersFromQuery(query);
      this.filters = uiFilters;
      this.pagerQueryParams = pagerParams;
      this.activeSearchFilters = requestFilters;
      this.loadContracts(requiredPage, requestFilters ?? undefined);
    });

    this.subscriptions.push(routeSub);
    this.refreshSummary();
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  navigateToCreate(): void {
    void this.router.navigate(['/purchase-sales/register']);
  }

  get pager(): PaginatedResponse<PurchaseSale> | undefined {
    return this.listState.pager;
  }

  get pagerUrl(): string {
    return '/purchase-sales/page';
  }

  get isListLoading(): boolean {
    return this.listState.loading;
  }

  get listError(): string | null {
    return this.listState.error;
  }

  get contracts(): PurchaseSale[] {
    return this.listState.items;
  }

  get totalContracts(): number {
    return this.summaryState().total;
  }

  get totalPurchases(): number {
    return this.summaryState().purchases;
  }

  get totalSales(): number {
    return this.summaryState().sales;
  }

  getVehicleBadgeClass(contract: PurchaseSale): string {
    return contract.contractType === ContractType.PURCHASE
      ? 'bg-primary-subtle text-primary-emphasis'
      : 'bg-success-subtle text-success-emphasis';
  }

  getStatusBadgeClass(status: ContractStatus): string {
    switch (status) {
      case ContractStatus.ACTIVE:
        return 'bg-primary-subtle text-primary-emphasis';
      case ContractStatus.COMPLETED:
        return 'bg-success-subtle text-success-emphasis';
      case ContractStatus.CANCELED:
        return 'bg-danger-subtle text-danger-emphasis';
      default:
        return 'bg-warning-subtle text-warning-emphasis';
    }
  }

  getStatusLabel(status: ContractStatus): string {
    return this.statusLabels[status] ?? status;
  }

  getContractTypeLabel(type: ContractType): string {
    return this.typeLabels[type] ?? type;
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return this.paymentMethodLabels[method] ?? method;
  }

  getClientLabel(contract: PurchaseSale): string {
    const summary = contract.clientSummary;
    if (summary) {
      const pieces = [summary.name ?? `Cliente ##${summary.id}`];
      if (summary.identifier) {
        pieces.push(summary.identifier);
      }
      return pieces.join(' - ');
    }

    const fallback = this.clientMap().get(contract.clientId);
    return fallback ? fallback.label : `Cliente #${contract.clientId}`;
  }

  getUserLabel(contract: PurchaseSale): string {
    const summary = contract.userSummary;
    if (summary) {
      const username = summary.username ? `@${summary.username}` : null;
      return [summary.fullName ?? `Usuario #${summary.id}`, username]
        .filter(Boolean)
        .join(' ');
    }

    const fallback = this.userMap().get(contract.userId);
    return fallback ? fallback.label : `Usuario #${contract.userId}`;
  }

  getVehicleLabel(contract: PurchaseSale): string {
    const summary = contract.vehicleSummary;
    if (summary) {
      const brand = summary.brand ?? 'Vehículo';
      const model = summary.model ?? 'N/D';
      const plate = summary.plate ?? 'N/D';
      return `${brand} ${model} (${plate})`;
    }

    if (!contract.vehicleId) {
      return 'Vehículo no disponible';
    }

    const fallback = this.vehicleMap().get(contract.vehicleId);
    return fallback ? fallback.label : 'Vehículo';
  }

  private getVehicleLabelById(vehicleId: number): string | null {
    const option = this.vehicleMap().get(vehicleId);
    return option ? option.label : null;
  }

  resetFilters(): void {
    this.clearFilters();
  }

  resetReportDates(): void {
    this.reportStartDate = null;
    this.reportEndDate = null;
  }

  applyFilters(): void {
    const queryParams = this.buildQueryParamsFromFilters();
    void this.router.navigate(['/purchase-sales/page', 0], {
      queryParams,
    });
  }

  clearFilters(): void {
    this.filters = this.getDefaultUiFilters();
    void this.router.navigate(['/purchase-sales/page', 0]);
  }

  downloadReport(format: 'pdf' | 'excel' | 'csv'): void {
    if (this.reportStartDate && this.reportEndDate) {
      if (this.reportStartDate > this.reportEndDate) {
        void Swal.fire({
          icon: 'warning',
          title: 'Rango inválido',
          text: 'La fecha inicial no puede ser posterior a la fecha final.',
        });
        return;
      }
    }

    this.exportLoading[format] = true;
    const start = this.reportStartDate ?? undefined;
    const end = this.reportEndDate ?? undefined;
    const request$ = this.getReportObservable(format, start, end);

    request$
      .pipe(finalize(() => (this.exportLoading[format] = false)))
      .subscribe({
        next: (blob) => {
          const extension = this.getExtension(format);
          const fileName = this.buildReportFileName(extension);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          this.showSuccessMessage(
            `Reporte ${extension.toUpperCase()} generado correctamente.`,
          );
        },
        error: (error) => this.handleError(error, 'generar el reporte'),
      });
  }

  private getReportObservable(
    format: 'pdf' | 'excel' | 'csv',
    start?: string,
    end?: string,
  ) {
    switch (format) {
      case 'pdf':
        return this.purchaseSaleService.downloadPdf(start, end);
      case 'excel':
        return this.purchaseSaleService.downloadExcel(start, end);
      case 'csv':
      default:
        return this.purchaseSaleService.downloadCsv(start, end);
    }
  }

  private getExtension(format: 'pdf' | 'excel' | 'csv'): 'pdf' | 'xlsx' | 'csv' {
    if (format === 'pdf') {
      return 'pdf';
    }
    if (format === 'excel') {
      return 'xlsx';
    }
    return 'csv';
  }

  private buildReportFileName(extension: 'pdf' | 'xlsx' | 'csv'): string {
    const today = new Date().toISOString().split('T')[0];
    const rangeLabel =
      this.reportStartDate || this.reportEndDate
        ? `${this.reportStartDate ?? 'inicio'}-a-${this.reportEndDate ?? 'fin'}`
        : 'completo';
    return `reporte-compras-ventas-${rangeLabel}-${today}.${extension}`;
  }

  updateStatus(contract: PurchaseSale, status: ContractStatus): void {
    if (!contract.id) {
      return;
    }

    const actionLabels: Record<ContractStatus, string> = {
      [ContractStatus.PENDING]: 'marcar como pendiente',
      [ContractStatus.ACTIVE]: 'marcar como activa',
      [ContractStatus.COMPLETED]: 'marcar como completada',
      [ContractStatus.CANCELED]: 'cancelar',
    };

    void Swal.fire({
      title: '¿Confirmas esta acción?',
      text: `Vas a ${actionLabels[status]} la operación #${contract.id}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'No, cancelar',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      const payload: PurchaseSale = {
        ...contract,
        contractStatus: status,
      };

      this.purchaseSaleService
        .update(contract.id!, payload)
        .pipe(
          tap(() => this.showSuccessMessage('Contrato actualizado con éxito.')),
        )
        .subscribe({
          next: () => {
            this.reloadCurrentPage();
            this.refreshSummary();
          },
          error: (error) => this.handleError(error, 'actualizar el contrato'),
        });
    });
  }

  private reloadCurrentPage(): void {
    this.loadContracts(this.currentPage, this.activeSearchFilters ?? undefined);
  }

  private loadContracts(
    page: number,
    filters?: PurchaseSaleSearchFilters,
  ): void {
    this.listState.loading = true;
    this.listState.error = null;

    const request$ = filters
      ? this.purchaseSaleService.searchPaginated({
          ...filters,
          page,
          size: 10,
        })
      : this.purchaseSaleService.getAllPaginated(page);

    request$
      .pipe(finalize(() => (this.listState.loading = false)))
      .subscribe({
        next: (pager) => {
          this.listState.items = pager.content;
          this.listState.pager = pager;
          this.currentPage = pager.number;
        },
        error: (error) => {
          this.listState.error =
            'No se pudieron cargar los contratos de compra/venta.';
          this.handleError(error, 'cargar los contratos', false);
        },
      });
  }

  private loadLookups(): void {
    const clients$ = forkJoin([
      this.personService.getAll(),
      this.companyService.getAll(),
    ]).pipe(
      map(([persons, companies]) => [
        ...mapPersonsToClients(persons),
        ...mapCompaniesToClients(companies),
      ]),
    );

    const users$ = this.userService.getAll().pipe(map(mapUsersToOptions));

    const vehicles$ = forkJoin([
      this.carService.getAll(),
      this.motorcycleService.getAll(),
    ]).pipe(
      map(([cars, motorcycles]) => [
        ...mapCarsToVehicles(cars),
        ...mapMotorcyclesToVehicles(motorcycles),
      ]),
    );

    const lookupSub = forkJoin([clients$, users$, vehicles$]).subscribe({
      next: ([clientOptions, userOptions, vehicleOptions]) => {
        this.clients.set(
          clientOptions.sort((a, b) => a.label.localeCompare(b.label)),
        );
        this.users.set(
          userOptions.sort((a, b) => a.label.localeCompare(b.label)),
        );
        this.vehicles.set(
          vehicleOptions.sort((a, b) => a.label.localeCompare(b.label)),
        );
      },
      error: (error) => {
        this.handleError(error, 'cargar la información auxiliar');
      },
    });

    this.subscriptions.push(lookupSub);
  }

  private refreshSummary(): void {
    const summarySub = this.purchaseSaleService.getAll().subscribe({
      next: (contracts) => {
        const purchases = contracts.filter(
          (contract) => contract.contractType === ContractType.PURCHASE,
        ).length;
        const sales = contracts.filter(
          (contract) => contract.contractType === ContractType.SALE,
        ).length;

        this.summaryState.set({
          total: contracts.length,
          purchases,
          sales,
        });
      },
      error: () =>
        this.summaryState.set({
          total: 0,
          purchases: 0,
          sales: 0,
        }),
    });

    this.subscriptions.push(summarySub);
  }

  private navigateToPage(page: number, queryParams?: Params): void {
    void this.router.navigate(['/purchase-sales/page', page], {
      queryParams,
    });
  }

  private parsePage(value: string | null): number {
    return value ? Number(value) : 0;
  }

  private getDefaultUiFilters(): PurchaseSaleUiFilters {
    return {
      contractType: 'ALL',
      contractStatus: 'ALL',
      clientId: '',
      userId: '',
      vehicleId: '',
      paymentMethod: '',
      term: '',
      minPurchasePrice: '',
      maxPurchasePrice: '',
      minSalePrice: '',
      maxSalePrice: '',
    };
  }

  private buildQueryParamsFromFilters(): Params | undefined {
    const params: Params = {};

    if (this.filters.contractType !== 'ALL') {
      params['contractType'] = this.filters.contractType;
    }

    if (this.filters.contractStatus !== 'ALL') {
      params['contractStatus'] = this.filters.contractStatus;
    }

    if (this.filters.paymentMethod) {
      params['paymentMethod'] = this.filters.paymentMethod;
    }

    [
      ['clientId', this.filters.clientId],
      ['userId', this.filters.userId],
      ['vehicleId', this.filters.vehicleId],
      ['term', this.filters.term],
      ['minPurchasePrice', this.filters.minPurchasePrice],
      ['maxPurchasePrice', this.filters.maxPurchasePrice],
      ['minSalePrice', this.filters.minSalePrice],
      ['maxSalePrice', this.filters.maxSalePrice],
    ].forEach(([key, value]) => {
      if (value) {
        params[key] = value;
      }
    });

    return Object.keys(params).length ? params : undefined;
  }

  private extractFiltersFromQuery(query: ParamMap): {
    uiFilters: PurchaseSaleUiFilters;
    requestFilters: PurchaseSaleSearchFilters | null;
    queryParams: Params | null;
  } {
    const uiFilters = this.getDefaultUiFilters();
    const requestFilters: PurchaseSaleSearchFilters = {};

    const contractTypeParam = query.get('contractType');
    if (this.isValidContractType(contractTypeParam)) {
      uiFilters.contractType = contractTypeParam as ContractTypeFilter;
      requestFilters.contractType = contractTypeParam as ContractType;
    }

    const contractStatusParam = query.get('contractStatus');
    if (this.isValidContractStatus(contractStatusParam)) {
      uiFilters.contractStatus = contractStatusParam as ContractStatusFilter;
      requestFilters.contractStatus = contractStatusParam as ContractStatus;
    }

    const paymentMethodParam = query.get('paymentMethod');
    if (this.isValidPaymentMethod(paymentMethodParam)) {
      uiFilters.paymentMethod = paymentMethodParam!;
      requestFilters.paymentMethod = paymentMethodParam as PaymentMethod;
    }

    const clientIdParam = query.get('clientId');
    if (clientIdParam) {
      uiFilters.clientId = clientIdParam;
      const parsed = this.parseNumberParam(clientIdParam);
      if (parsed !== undefined) {
        requestFilters.clientId = parsed;
      }
    }

    const userIdParam = query.get('userId');
    if (userIdParam) {
      uiFilters.userId = userIdParam;
      const parsed = this.parseNumberParam(userIdParam);
      if (parsed !== undefined) {
        requestFilters.userId = parsed;
      }
    }

    const vehicleIdParam = query.get('vehicleId');
    if (vehicleIdParam) {
      uiFilters.vehicleId = vehicleIdParam;
      const parsed = this.parseNumberParam(vehicleIdParam);
      if (parsed !== undefined) {
        requestFilters.vehicleId = parsed;
      }
    }

    const minPurchase = query.get('minPurchasePrice');
    if (minPurchase) {
      uiFilters.minPurchasePrice = minPurchase;
      const parsed = this.parseNumberParam(minPurchase);
      if (parsed !== undefined) {
        requestFilters.minPurchasePrice = parsed;
      }
    }

    const maxPurchase = query.get('maxPurchasePrice');
    if (maxPurchase) {
      uiFilters.maxPurchasePrice = maxPurchase;
      const parsed = this.parseNumberParam(maxPurchase);
      if (parsed !== undefined) {
        requestFilters.maxPurchasePrice = parsed;
      }
    }

    const minSale = query.get('minSalePrice');
    if (minSale) {
      uiFilters.minSalePrice = minSale;
      const parsed = this.parseNumberParam(minSale);
      if (parsed !== undefined) {
        requestFilters.minSalePrice = parsed;
      }
    }

    const maxSale = query.get('maxSalePrice');
    if (maxSale) {
      uiFilters.maxSalePrice = maxSale;
      const parsed = this.parseNumberParam(maxSale);
      if (parsed !== undefined) {
        requestFilters.maxSalePrice = parsed;
      }
    }

    const term = query.get('term');
    if (term) {
      uiFilters.term = term;
      requestFilters.term = term;
    }

    const queryParams = this.paramMapToObject(query);
    const hasFilters = !this.arePurchaseSaleFiltersEmpty(requestFilters);

    return {
      uiFilters,
      requestFilters: hasFilters ? requestFilters : null,
      queryParams,
    };
  }

  private paramMapToObject(map: ParamMap): Params | null {
    const params: Params = {};
    map.keys.forEach((key) => {
      const value = map.get(key);
      if (value) {
        params[key] = value;
      }
    });
    return Object.keys(params).length ? params : null;
  }

  private parseNumberParam(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private arePurchaseSaleFiltersEmpty(
    filters: PurchaseSaleSearchFilters,
  ): boolean {
    return Object.values(filters).every(
      (value) => value === undefined || value === null,
    );
  }

  private isValidContractType(value: string | null): value is ContractType {
    return !!value && this.contractTypes.includes(value as ContractType);
  }

  private isValidContractStatus(value: string | null): value is ContractStatus {
    return !!value && this.contractStatuses.includes(value as ContractStatus);
  }

  private isValidPaymentMethod(value: string | null): value is PaymentMethod {
    return (
      !!value &&
      Object.values(PaymentMethod).includes(value as PaymentMethod)
    );
  }

  private showSuccessMessage(message: string): void {
    void Swal.fire({
      icon: 'success',
      title: 'Operación exitosa',
      text: message,
      timer: 2200,
      showConfirmButton: false,
    });
  }

  private handleError(
    error: unknown,
    action: string,
    displayAlert = true,
  ): void {
    const details =
      (error as { error?: { details?: string } })?.error?.details ?? null;
    const message = this.decorateVehicleMessage(
      details ??
        `Se presentó un inconveniente al ${action}. Intenta nuevamente.`,
    );

    if (displayAlert) {
      void Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: message,
      });
    }
  }

  private decorateVehicleMessage(message: string | null): string {
    if (!message) {
      return '';
    }

    return message.replace(/veh[ií]culo con id (\d+)/gi, (_, id: string) => {
      const numericId = Number(id);
      const label = this.getVehicleLabelById(numericId);
      return label ?? `vehículo con id ${id}`;
    });
  }
}
