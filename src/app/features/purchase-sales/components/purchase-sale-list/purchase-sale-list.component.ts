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
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize, forkJoin, map, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
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

@Component({
  selector: 'app-purchase-sale-list',
  imports: [
    CommonModule,
    FormsModule,
    HasPermissionDirective,
    PagerComponent,
    UtcToGmtMinus5Pipe,
  ],
  templateUrl: './purchase-sale-list.component.html',
  styleUrl: './purchase-sale-list.component.css',
})
export class PurchaseSaleListComponent implements OnInit, OnDestroy {
  readonly contractStatuses = Object.values(ContractStatus);
  readonly contractTypes = Object.values(ContractType);
  readonly ContractStatus = ContractStatus;
  readonly ContractType = ContractType;

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

  filterType: ContractTypeFilter = 'ALL';
  filterStatus: ContractStatusFilter = 'ALL';
  searchTerm = '';

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
    const routeSub = this.route.paramMap.subscribe((params) => {
      const pageParam = params.get('page');
      const requiredPage = this.parsePage(pageParam);
      if (Number.isNaN(requiredPage) || requiredPage < 0) {
        this.navigateToPage(0);
        return;
      }
      this.loadContracts(requiredPage);
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
    if (!this.listState.items.length) {
      return [];
    }

    return this.listState.items.filter((contract) => {
      const matchesType =
        this.filterType === 'ALL' || contract.contractType === this.filterType;
      const matchesStatus =
        this.filterStatus === 'ALL' ||
        contract.contractStatus === this.filterStatus;
      const matchesSearch = this.matchesSearchTerm(contract);
      return matchesType && matchesStatus && matchesSearch;
    });
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
    this.filterType = 'ALL';
    this.filterStatus = 'ALL';
    this.searchTerm = '';
  }

  resetReportDates(): void {
    this.reportStartDate = null;
    this.reportEndDate = null;
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
    this.loadContracts(this.currentPage);
  }

  private loadContracts(page: number): void {
    this.listState.loading = true;
    this.listState.error = null;

    this.purchaseSaleService
      .getAllPaginated(page)
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

  private navigateToPage(page: number): void {
    void this.router.navigate(['/purchase-sales/page', page]);
  }

  private parsePage(value: string | null): number {
    return value ? Number(value) : 0;
  }

  private matchesSearchTerm(contract: PurchaseSale): boolean {
    if (!this.searchTerm) {
      return true;
    }
    const term = this.searchTerm.toLowerCase();
    const entries = [
      contract.id?.toString() ?? '',
      contract.vehicleId?.toString() ?? '',
      this.getClientLabel(contract).toLowerCase(),
      this.getUserLabel(contract).toLowerCase(),
      this.getVehicleLabel(contract).toLowerCase(),
      this.getContractTypeLabel(contract.contractType).toLowerCase(),
      this.getStatusLabel(contract.contractStatus).toLowerCase(),
      contract.paymentMethod.toLowerCase(),
      this.getPaymentMethodLabel(contract.paymentMethod).toLowerCase(),
      contract.paymentTerms.toLowerCase(),
      contract.paymentLimitations.toLowerCase(),
      contract.observations?.toLowerCase() ?? '',
    ];

    return entries.some((value) => value.includes(term));
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
