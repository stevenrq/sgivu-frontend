import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize, forkJoin, map, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
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
import { Person } from '../../../clients/models/person.model.';
import { Company } from '../../../clients/models/company.model';
import { User } from '../../../users/models/user.model';
import { Car } from '../../../vehicles/models/car.model';
import { Motorcycle } from '../../../vehicles/models/motorcycle.model';
import { VehicleStatus } from '../../../vehicles/models/vehicle-status.enum';

interface ClientOption {
  id: number;
  label: string;
  type: 'PERSON' | 'COMPANY';
}

interface UserOption {
  id: number;
  label: string;
}

interface VehicleOption {
  id: number;
  label: string;
  status: VehicleStatus;
  type: 'CAR' | 'MOTORCYCLE';
}

interface PurchaseFormModel {
  clientId: number | null;
  userId: number | null;
  vehicleId: number | null;
  purchasePrice: number | null;
  contractStatus: ContractStatus;
  paymentLimitations: string;
  paymentTerms: string;
  paymentMethod: PaymentMethod;
  observations: string;
}

interface SaleFormModel extends PurchaseFormModel {
  salePrice: number | null;
  contractType: ContractType;
}

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
  ],
  templateUrl: './purchase-sale-list.component.html',
  styleUrl: './purchase-sale-list.component.css',
})
export class PurchaseSaleListComponent implements OnInit, OnDestroy {
  readonly contractStatuses = Object.values(ContractStatus);
  readonly paymentMethods = Object.values(PaymentMethod);
  readonly contractTypes = Object.values(ContractType);
  readonly ContractStatus = ContractStatus;

  purchaseForm: PurchaseFormModel = this.createDefaultPurchaseForm();
  saleForm: SaleFormModel = this.createDefaultSaleForm();

  readonly clients: WritableSignal<ClientOption[]> = signal<ClientOption[]>([]);
  readonly users: WritableSignal<UserOption[]> = signal<UserOption[]>([]);
  readonly vehicles: WritableSignal<VehicleOption[]> = signal<VehicleOption[]>(
    [],
  );

  readonly isLoadingLookups = signal(false);
  readonly hasLookupError = signal(false);

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

  purchaseLoading = false;
  saleLoading = false;
  listState: PurchaseSaleListState = {
    items: [],
    loading: false,
    error: null,
  };

  private currentPage = 0;
  private readonly subscriptions: Subscription[] = [];

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

  getClientLabel(clientId: number): string {
    const client = this.clientMap().get(clientId);
    return client ? client.label : `Cliente #${clientId}`;
  }

  getUserLabel(userId: number): string {
    const user = this.userMap().get(userId);
    return user ? user.label : `Usuario #${userId}`;
  }

  getVehicleLabel(vehicleId: number): string {
    const vehicle = this.vehicleMap().get(vehicleId);
    return vehicle ? vehicle.label : `Vehículo #${vehicleId}`;
  }

  resetFilters(): void {
    this.filterType = 'ALL';
    this.filterStatus = 'ALL';
    this.searchTerm = '';
  }

  createPurchase(purchaseFormRef: NgForm): void {
    if (!purchaseFormRef.valid) {
      this.showValidationError();
      return;
    }

    const payload: PurchaseSale = {
      clientId: Number(this.purchaseForm.clientId),
      userId: Number(this.purchaseForm.userId),
      vehicleId: Number(this.purchaseForm.vehicleId),
      purchasePrice: Number(this.purchaseForm.purchasePrice),
      salePrice: 0,
      contractStatus: this.purchaseForm.contractStatus,
      contractType: ContractType.PURCHASE,
      paymentLimitations: this.purchaseForm.paymentLimitations.trim(),
      paymentTerms: this.purchaseForm.paymentTerms.trim(),
      paymentMethod: this.purchaseForm.paymentMethod,
      observations: this.purchaseForm.observations?.trim() ?? null,
    };

    this.purchaseLoading = true;

    this.purchaseSaleService
      .create(payload)
      .pipe(finalize(() => (this.purchaseLoading = false)))
      .subscribe({
        next: () => {
          this.resetPurchaseForm(purchaseFormRef);
          this.reloadCurrentPage();
          this.refreshSummary();
          this.showSuccessMessage('Compra registrada con éxito.');
        },
        error: (error) => this.handleError(error, 'registrar la compra'),
      });
  }

  createSale(saleFormRef: NgForm): void {
    if (!saleFormRef.valid) {
      this.showValidationError();
      return;
    }

    const payload: PurchaseSale = {
      clientId: Number(this.saleForm.clientId),
      userId: Number(this.saleForm.userId),
      vehicleId: Number(this.saleForm.vehicleId),
      purchasePrice: Number(this.saleForm.purchasePrice),
      salePrice: Number(this.saleForm.salePrice),
      contractStatus: this.saleForm.contractStatus,
      contractType: ContractType.SALE,
      paymentLimitations: this.saleForm.paymentLimitations.trim(),
      paymentTerms: this.saleForm.paymentTerms.trim(),
      paymentMethod: this.saleForm.paymentMethod,
      observations: this.saleForm.observations?.trim() ?? null,
    };

    this.saleLoading = true;
    this.purchaseSaleService
      .create(payload)
      .pipe(finalize(() => (this.saleLoading = false)))
      .subscribe({
        next: () => {
          this.resetSaleForm(saleFormRef);
          this.reloadCurrentPage();
          this.refreshSummary();
          this.showSuccessMessage('Venta registrada con éxito.');
        },
        error: (error) => this.handleError(error, 'registrar la venta'),
      });
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
    this.isLoadingLookups.set(true);
    this.hasLookupError.set(false);

    const clients$ = forkJoin([
      this.personService.getAll(),
      this.companyService.getAll(),
    ]).pipe(
      map(([persons, companies]) => [
        ...this.mapPersonsToClients(persons),
        ...this.mapCompaniesToClients(companies),
      ]),
    );

    const users$ = this.userService.getAll().pipe(
      map((users) =>
        users.map((user) => ({
          id: user.id!,
          label: `${user.firstName} ${user.lastName} (@${user.username})`,
        })),
      ),
    );

    const vehicles$ = forkJoin([
      this.carService.getAll(),
      this.motorcycleService.getAll(),
    ]).pipe(
      map(([cars, motorcycles]) => [
        ...this.mapCarsToVehicles(cars),
        ...this.mapMotorcyclesToVehicles(motorcycles),
      ]),
    );

    const lookupSub = forkJoin([clients$, users$, vehicles$])
      .pipe(finalize(() => this.isLoadingLookups.set(false)))
      .subscribe({
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
          this.hasLookupError.set(true);
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

  private createDefaultPurchaseForm(): PurchaseFormModel {
    return {
      clientId: null,
      userId: null,
      vehicleId: null,
      purchasePrice: null,
      contractStatus: ContractStatus.PENDING,
      paymentLimitations: '',
      paymentTerms: '',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      observations: '',
    };
  }

  private createDefaultSaleForm(): SaleFormModel {
    return {
      ...this.createDefaultPurchaseForm(),
      salePrice: null,
      contractType: ContractType.SALE,
    };
  }

  resetPurchaseForm(form?: NgForm): void {
    this.purchaseForm = this.createDefaultPurchaseForm();
    form?.resetForm({ ...this.purchaseForm });
  }

  resetSaleForm(form?: NgForm): void {
    this.saleForm = this.createDefaultSaleForm();
    form?.resetForm({ ...this.saleForm });
  }

  private mapPersonsToClients(persons: Person[]): ClientOption[] {
    return persons
      .filter((person) => person.id)
      .map((person) => ({
        id: person.id!,
        label: `${person.firstName} ${person.lastName} (CC ${person.nationalId ?? 'N/A'})`,
        type: 'PERSON' as const,
      }));
  }

  private mapCompaniesToClients(companies: Company[]): ClientOption[] {
    return companies
      .filter((company) => company.id)
      .map((company) => ({
        id: company.id!,
        label: `${company.companyName} (NIT ${company.taxId ?? 'N/A'})`,
        type: 'COMPANY' as const,
      }));
  }

  private mapCarsToVehicles(cars: Car[]): VehicleOption[] {
    return cars.map((car) => ({
      id: car.id,
      label: `#${car.id} · ${car.brand} ${car.model} (${car.plate})`,
      status: car.status,
      type: 'CAR' as const,
    }));
  }

  private mapMotorcyclesToVehicles(
    motorcycles: Motorcycle[],
  ): VehicleOption[] {
    return motorcycles.map((motorcycle) => ({
      id: motorcycle.id,
      label: `#${motorcycle.id} · ${motorcycle.brand} ${motorcycle.model} (${motorcycle.plate})`,
      status: motorcycle.status,
      type: 'MOTORCYCLE' as const,
    }));
  }

  private matchesSearchTerm(contract: PurchaseSale): boolean {
    if (!this.searchTerm) {
      return true;
    }
    const term = this.searchTerm.toLowerCase();
    const entries = [
      contract.id?.toString() ?? '',
      this.getClientLabel(contract.clientId).toLowerCase(),
      this.getUserLabel(contract.userId).toLowerCase(),
      this.getVehicleLabel(contract.vehicleId).toLowerCase(),
      contract.paymentMethod.toLowerCase(),
      contract.paymentTerms.toLowerCase(),
      contract.paymentLimitations.toLowerCase(),
      contract.observations?.toLowerCase() ?? '',
    ];

    return entries.some((value) => value.includes(term));
  }

  private showValidationError(): void {
    void Swal.fire({
      icon: 'warning',
      title: 'Formulario incompleto',
      text: 'Por favor, completa todos los campos obligatorios antes de continuar.',
    });
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

    if (displayAlert) {
      void Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text:
          details ??
          `Se presentó un inconveniente al ${action}. Intenta nuevamente.`,
      });
    }
  }
}
