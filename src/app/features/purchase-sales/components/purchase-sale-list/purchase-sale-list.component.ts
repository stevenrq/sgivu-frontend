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
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import {
  normalizeMoneyInput,
  parseCopCurrency,
} from '../../../../shared/utils/currency.utils';
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
type PriceFilterKey =
  | 'minPurchasePrice'
  | 'maxPurchasePrice'
  | 'minSalePrice'
  | 'maxSalePrice';

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

type QuickSuggestionType =
  | 'client'
  | 'user'
  | 'vehicle'
  | 'status'
  | 'type';
type QuickSuggestion = {
  label: string;
  context: string;
  type: QuickSuggestionType;
  value: string;
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
    CopCurrencyPipe,
  ],
  templateUrl: './purchase-sale-list.component.html',
  styleUrl: './purchase-sale-list.component.css',
})
/**
 * Coordina el listado de contratos de compra/venta. Además de paginar, mantiene
 * sincronizados filtros complejos con la URL, carga catálogos auxiliares
 * (clientes, usuarios y vehículos) y genera métricas/resúmenes utilizados en
 * múltiples vistas. También expone sugerencias rápidas para búsquedas libres.
 */
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
  quickSuggestions: QuickSuggestion[] = [];
  private readonly linkedClientIds = new Set<number>();
  private readonly linkedUserIds = new Set<number>();
  private readonly linkedVehicleIds = new Set<number>();

  private currentPage = 0;
  private readonly subscriptions: Subscription[] = [];
  private activeSearchFilters: PurchaseSaleSearchFilters | null = null;
  pagerQueryParams: Params | null = null;
  private readonly priceDecimals = 0;
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
    this.quickSuggestions = [];
    this.hintQuickSearchFilters();
    const queryParams = this.buildQueryParamsFromFilters();
    void this.router.navigate(['/purchase-sales/page', 0], {
      queryParams,
    });
  }

  clearFilters(): void {
    this.filters = this.getDefaultUiFilters();
    this.quickSuggestions = [];
    void this.router.navigate(['/purchase-sales/page', 0]);
  }

  onPriceFilterChange(field: PriceFilterKey, rawValue: string): void {
    const { displayValue } = normalizeMoneyInput(rawValue, this.priceDecimals);
    this.filters[field] = displayValue;
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

  onQuickSearchChange(term: string): void {
    this.filters.term = term;
    this.updateQuickSuggestions(term);
  }

  selectQuickSuggestion(suggestion: QuickSuggestion): void {
    if (suggestion.type === 'client') {
      this.filters.clientId = suggestion.value;
      this.filters.term = '';
    } else if (suggestion.type === 'user') {
      this.filters.userId = suggestion.value;
      this.filters.term = '';
    } else if (suggestion.type === 'vehicle') {
      this.filters.vehicleId = suggestion.value;
      this.filters.term = '';
    } else if (suggestion.type === 'status') {
      this.filters.contractStatus = suggestion.value as ContractStatusFilter;
      this.filters.term = '';
    } else if (suggestion.type === 'type') {
      this.filters.contractType = suggestion.value as ContractTypeFilter;
      this.filters.term = '';
    }

    this.quickSuggestions = [];
    this.applyFilters();
  }

  /**
   * Devuelve el observable apropiado para descargar el reporte según el formato requerido.
   * Centraliza las llamadas de servicio para mantener el switch en un solo lugar.
   *
   * @param format Formato solicitado por el usuario.
   * @param start Fecha inicial del reporte (opcional).
   * @param end Fecha final del reporte (opcional).
   * @returns Observable que emite el archivo generado.
   */
  private getReportObservable(format: 'pdf' | 'excel' | 'csv', start?: string, end?: string) {
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

  /**
   * Traduce el formato semántico seleccionado en la UI a la extensión real del archivo generado.
   *
   * @param format Identificador del formato (pdf/excel/csv).
   * @returns Extensión asociada al archivo descargado.
   */
  private getExtension(format: 'pdf' | 'excel' | 'csv'): 'pdf' | 'xlsx' | 'csv' {
    if (format === 'pdf') {
      return 'pdf';
    }
    if (format === 'excel') {
      return 'xlsx';
    }
    return 'csv';
  }

  /**
   * Construye el nombre del archivo descargado incluyendo el rango aplicado para facilitar la
   * trazabilidad de reportes guardados localmente.
   *
   * @param extension Extensión final del documento.
   * @returns Nombre amigable para el archivo.
   */
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

  /**
   * Descarga los contratos de la página solicitada; cuando se reciben filtros
   * construidos desde la URL, invoca el endpoint de búsqueda para mantener
   * paginación y query params alineados.
   *
   * @param page - Índice actual solicitado por la ruta.
   * @param filters - Filtros efectivos que ya pasaron por `extractFiltersFromQuery`.
   */
  private loadContracts(page: number, filters?: PurchaseSaleSearchFilters): void {
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

  /**
   * Obtiene en paralelo los catálogos de clientes, usuarios y vehículos que se
   * usan en filtros, sugerencias y validaciones. Todos los resultados se
   * normalizan en listas ordenadas para facilitar su reuso en plantillas.
   *
   * @returns void
   */
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

  /**
   * Vuelve a calcular los KPIs (totales, compras, ventas) y también actualiza
   * los conjuntos de ids vinculados para que las búsquedas rápidas sugieran
   * entidades con contratos existentes.
   *
   * @returns void
   */
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
        this.updateLinkedEntities(contracts);
      },
      error: () => {
        this.summaryState.set({
          total: 0,
          purchases: 0,
          sales: 0,
        });
        this.updateLinkedEntities([]);
      },
    });

    this.subscriptions.push(summarySub);
  }

  /**
   * Reconstruye los conjuntos de clientes, usuarios y vehículos que tienen
   * contratos asociados. Se ejecuta tras refrescar el resumen para que las
   * sugerencias sólo muestren entidades realmente enlazadas.
   *
   * @param contracts - Colección desde la cual se extraen los ids vinculados.
   * @returns void
   */
  private updateLinkedEntities(contracts: PurchaseSale[]): void {
    this.linkedClientIds.clear();
    this.linkedUserIds.clear();
    this.linkedVehicleIds.clear();

    contracts.forEach((contract) => {
      this.trackLinkedId(this.linkedClientIds, contract.clientId);
      this.trackLinkedId(this.linkedUserIds, contract.userId);
      this.trackLinkedId(this.linkedVehicleIds, contract.vehicleId);
    });
  }

  private trackLinkedId(
    target: Set<number>,
    value: number | null | undefined,
  ): void {
    if (typeof value === 'number' && Number.isFinite(value)) {
      target.add(value);
    }
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

  /**
   * Aprovecha la búsqueda rápida para rellenar filtros específicos cuando es
   * posible. Por ejemplo, si el término coincide con un cliente/vehículo/usuario
   * conocido, se precarga su id en el filtro correspondiente además de enviar el
   * término libre.
   *
   * @returns void
   */
  private hintQuickSearchFilters(): void {
    const rawTerm = (this.filters.term ?? '').trim();
    if (!rawTerm) {
      return;
    }

    const normalized = rawTerm.toLowerCase();

    const vehicleMatch = this.vehicles().find(
      (vehicle) =>
        this.linkedVehicleIds.has(vehicle.id) &&
        this.includesTerm(vehicle.label, normalized),
    );
    if (vehicleMatch && !this.filters.vehicleId) {
      this.filters.vehicleId = vehicleMatch.id.toString();
    }

    const clientMatch = this.clients().find(
      (client) =>
        this.linkedClientIds.has(client.id) &&
        this.includesTerm(client.label, normalized),
    );
    if (clientMatch && !this.filters.clientId) {
      this.filters.clientId = clientMatch.id.toString();
    }

    const userMatch = this.users().find(
      (user) =>
        this.linkedUserIds.has(user.id) &&
        this.includesTerm(user.label, normalized),
    );
    if (userMatch && !this.filters.userId) {
      this.filters.userId = userMatch.id.toString();
    }

    this.filters.term = rawTerm;
  }

  /**
   * Recalcula las sugerencias rápidas considerando clientes, usuarios,
   * vehículos y coincidencias de tipo/estado. Limita los resultados para
   * mantener la lista ligera.
   *
   * @param term - Texto ingresado por el usuario en la búsqueda libre.
   * @returns void
   */
  private updateQuickSuggestions(term: string): void {
    const normalized = term.trim().toLowerCase();
    if (normalized.length < 2) {
      this.quickSuggestions = [];
      return;
    }

    const matches: QuickSuggestion[] = [];

    this.clients()
      .filter(
        (client) =>
          this.linkedClientIds.has(client.id) &&
          this.includesTerm(client.label, normalized),
      )
      .slice(0, 3)
      .forEach((client) =>
        matches.push({
          label: client.label,
          context: 'Cliente con contratos',
          type: 'client',
          value: client.id.toString(),
        }),
      );

    this.users()
      .filter(
        (user) =>
          this.linkedUserIds.has(user.id) &&
          this.includesTerm(user.label, normalized),
      )
      .slice(0, 3)
      .forEach((user) =>
        matches.push({
          label: user.label,
          context: 'Usuario con contratos',
          type: 'user',
          value: user.id.toString(),
        }),
      );

    this.vehicles()
      .filter(
        (vehicle) =>
          this.linkedVehicleIds.has(vehicle.id) &&
          this.includesTerm(vehicle.label, normalized),
      )
      .slice(0, 3)
      .forEach((vehicle) =>
        matches.push({
          label: vehicle.label,
          context: 'Vehículo utilizado en contratos',
          type: 'vehicle',
          value: vehicle.id.toString(),
        }),
      );

    this.contractStatuses
      .filter((status) => this.matchesStatus(status, normalized))
      .forEach((status) =>
        matches.push({
          label: this.getStatusLabel(status),
          context: 'Estado de contrato',
          type: 'status',
          value: status,
        }),
      );

    this.contractTypes
      .filter((type) => this.matchesType(type, normalized))
      .forEach((type) =>
        matches.push({
          label: this.getContractTypeLabel(type),
          context: 'Tipo de contrato',
          type: 'type',
          value: type,
        }),
      );

    this.quickSuggestions = matches.slice(0, 9);
  }

  /**
   * Convierte los filtros de la UI en query params limpios para sincronizar la
   * URL y compartir búsquedas. Solo incluye valores válidos o convertidos.
   *
   * @returns Objeto de parámetros o `undefined` si no hay filtros activos.
   */
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
    ].forEach(([key, value]) => {
      if (value) {
        params[key] = value;
      }
    });

    const parsedPriceFilters: Partial<Record<PriceFilterKey, number | null>> = {
      minPurchasePrice: this.parsePriceFilter(this.filters.minPurchasePrice),
      maxPurchasePrice: this.parsePriceFilter(this.filters.maxPurchasePrice),
      minSalePrice: this.parsePriceFilter(this.filters.minSalePrice),
      maxSalePrice: this.parsePriceFilter(this.filters.maxSalePrice),
    };

    (Object.entries(parsedPriceFilters) as Array<[PriceFilterKey, number | null]>).forEach(
      ([key, value]) => {
        if (value !== null) {
          params[key] = value;
        }
      },
    );

    return Object.keys(params).length ? params : undefined;
  }

  private includesTerm(value: string, normalizedTerm: string): boolean {
    return value.toLowerCase().includes(normalizedTerm);
  }

  private matchesStatus(
    status: ContractStatus,
    normalizedTerm: string,
  ): boolean {
    const label = this.getStatusLabel(status).toLowerCase();
    return (
      label.includes(normalizedTerm) ||
      status.toLowerCase().includes(normalizedTerm)
    );
  }

  private matchesType(type: ContractType, normalizedTerm: string): boolean {
    const label = this.getContractTypeLabel(type).toLowerCase();
    return (
      label.includes(normalizedTerm) ||
      type.toLowerCase().includes(normalizedTerm)
    );
  }

  /**
   * Rehidrata los filtros partiendo de los query params, separando el estado de
   * formulario (strings) de los filtros que se enviarán al backend.
   *
   * @param query - Parámetros activos tomados de la ruta.
   * @returns Filtros para la UI, filtros efectivos y la representación final de query params.
   */
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
      const { numericValue, displayValue } = normalizeMoneyInput(
        minPurchase,
        this.priceDecimals,
      );
      uiFilters.minPurchasePrice = displayValue;
      if (numericValue !== null) {
        requestFilters.minPurchasePrice = numericValue;
      }
    }

    const maxPurchase = query.get('maxPurchasePrice');
    if (maxPurchase) {
      const { numericValue, displayValue } = normalizeMoneyInput(
        maxPurchase,
        this.priceDecimals,
      );
      uiFilters.maxPurchasePrice = displayValue;
      if (numericValue !== null) {
        requestFilters.maxPurchasePrice = numericValue;
      }
    }

    const minSale = query.get('minSalePrice');
    if (minSale) {
      const { numericValue, displayValue } = normalizeMoneyInput(
        minSale,
        this.priceDecimals,
      );
      uiFilters.minSalePrice = displayValue;
      if (numericValue !== null) {
        requestFilters.minSalePrice = numericValue;
      }
    }

    const maxSale = query.get('maxSalePrice');
    if (maxSale) {
      const { numericValue, displayValue } = normalizeMoneyInput(
        maxSale,
        this.priceDecimals,
      );
      uiFilters.maxSalePrice = displayValue;
      if (numericValue !== null) {
        requestFilters.maxSalePrice = numericValue;
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

  private parsePriceFilter(value: string): number | null {
    const parsed = parseCopCurrency(value);
    if (parsed === null) {
      return null;
    }
    const factor = Math.pow(10, this.priceDecimals);
    const normalized =
      this.priceDecimals > 0
        ? Math.round(parsed * factor) / factor
        : Math.round(parsed);
    const sanitized = Math.max(0, normalized);
    return Number.isFinite(sanitized) ? sanitized : null;
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
