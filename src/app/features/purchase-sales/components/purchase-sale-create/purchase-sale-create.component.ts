import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  WritableSignal,
  computed,
  signal,
} from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  RouterLink,
} from '@angular/router';
import {
  Subscription,
  finalize,
  forkJoin,
  map,
} from 'rxjs';
import Swal from 'sweetalert2';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
import {
  PurchaseSale,
  VehicleCreationPayload,
} from '../../models/purchase-sale.model';
import { ContractType } from '../../models/contract-type.enum';
import { ContractStatus } from '../../models/contract-status.enum';
import { PaymentMethod } from '../../models/payment-method.enum';
import { PersonService } from '../../../clients/services/person.service';
import { CompanyService } from '../../../clients/services/company.service';
import { UserService } from '../../../users/services/user.service';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { VehicleKind } from '../../models/vehicle-kind.enum';
import { VehicleStatus } from '../../../vehicles/models/vehicle-status.enum';
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

interface ContractFormModel {
  clientId: number | null;
  userId: number | null;
  vehicleId: number | null;
  contractType: ContractType;
  contractStatus: ContractStatus;
  purchasePrice: number | null;
  salePrice: number | null;
  paymentLimitations: string;
  paymentTerms: string;
  paymentMethod: PaymentMethod;
  observations: string;
}

interface VehicleFormModel {
  vehicleType: VehicleKind;
  brand: string;
  model: string;
  capacity: number | null;
  line: string;
  plate: string;
  motorNumber: string;
  serialNumber: string;
  chassisNumber: string;
  color: string;
  cityRegistered: string;
  year: number | null;
  mileage: number | null;
  transmission: string;
  salePrice: number | null;
  photoUrl: string;
  bodyType: string;
  fuelType: string;
  numberOfDoors: number | null;
  motorcycleType: string;
}

@Component({
  selector: 'app-purchase-sale-create',
  imports: [CommonModule, FormsModule, HasPermissionDirective, RouterLink],
  templateUrl: './purchase-sale-create.component.html',
  styleUrl: './purchase-sale-create.component.css',
})
export class PurchaseSaleCreateComponent implements OnInit, OnDestroy {
  readonly contractStatuses = Object.values(ContractStatus);
  readonly paymentMethods = Object.values(PaymentMethod);
  readonly contractTypes = Object.values(ContractType);
  readonly vehicleKinds = Object.values(VehicleKind);
  readonly ContractStatus = ContractStatus;
  readonly ContractType = ContractType;

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  private readonly mileageFormatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  contractForm: ContractFormModel = this.createDefaultContractForm();
  vehicleForm: VehicleFormModel = this.createDefaultVehicleForm();
  formSubmitted = false;
  purchasePriceInput = '';
  salePriceInput = '';
  vehicleSalePriceInput = '';
  vehicleMileageInput = '';

  readonly clients: WritableSignal<ClientOption[]> = signal<ClientOption[]>([]);
  readonly users: WritableSignal<UserOption[]> = signal<UserOption[]>([]);
  readonly vehicles: WritableSignal<VehicleOption[]> = signal<VehicleOption[]>(
    [],
  );

  readonly isLoadingLookups = signal(false);
  readonly hasLookupError = signal(false);

  readonly summaryState = signal({
    total: 0,
    purchases: 0,
    sales: 0,
  });

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

  readonly availableVehicles = computed(() =>
    this.vehicles().filter(
      (vehicle) => vehicle.status === VehicleStatus.AVAILABLE,
    ),
  );

  formLoading = false;
  private readonly salePurchaseCache = new Map<number, number>();
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
    this.refreshSummary();
    const paramsSub = this.route.queryParamMap.subscribe((params) =>
      this.applyQueryParams(params),
    );
    this.subscriptions.push(paramsSub);
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
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

  get isPurchaseType(): boolean {
    return this.contractForm.contractType === ContractType.PURCHASE;
  }

  get isSaleType(): boolean {
    return this.contractForm.contractType === ContractType.SALE;
  }

  get isCarSelected(): boolean {
    return this.vehicleForm.vehicleType === VehicleKind.CAR;
  }

  get isMotorcycleSelected(): boolean {
    return this.vehicleForm.vehicleType === VehicleKind.MOTORCYCLE;
  }

  get saleVehicleOptions(): VehicleOption[] {
    return this.availableVehicles();
  }

  submitContract(contractFormRef: NgForm): void {
    this.formSubmitted = true;
    if (!contractFormRef.valid) {
      this.showValidationError();
      return;
    }

    const purchasePrice = this.contractForm.purchasePrice ?? 0;
    const salePrice = this.isSaleType
      ? (this.contractForm.salePrice ?? 0)
      : (this.vehicleForm.salePrice ?? 0);

    const payload: PurchaseSale = {
      clientId: Number(this.contractForm.clientId),
      userId: Number(this.contractForm.userId),
      purchasePrice,
      salePrice,
      contractStatus: this.contractForm.contractStatus,
      contractType: this.contractForm.contractType,
      paymentLimitations: this.contractForm.paymentLimitations.trim(),
      paymentTerms: this.contractForm.paymentTerms.trim(),
      paymentMethod: this.contractForm.paymentMethod,
      observations: this.contractForm.observations?.trim() ?? null,
    };

    if (this.isSaleType) {
      payload.vehicleId = Number(this.contractForm.vehicleId);
    } else {
      payload.vehicleData = this.buildVehiclePayload();
    }

    this.formLoading = true;
    this.purchaseSaleService
      .create(payload)
      .pipe(finalize(() => (this.formLoading = false)))
      .subscribe({
        next: () => {
          this.resetContractForm(contractFormRef, true);
          this.salePurchaseCache.clear();
          this.refreshSummary();
          void this.showSuccessMessage('Contrato registrado con éxito.').then(
            () => {
              void this.router.navigate(['/purchase-sales/page', 0]);
            },
          );
        },
        error: (error) => this.handleError(error, 'registrar el contrato'),
      });
  }

  onContractTypeChange(type: ContractType): void {
    this.contractForm.contractType = type;
    if (type === ContractType.PURCHASE) {
      this.contractForm.salePrice = null;
      this.contractForm.vehicleId = null;
      this.contractForm.purchasePrice = null;
      this.purchasePriceInput = '';
      this.salePriceInput = '';
      return;
    }

    this.contractForm.salePrice = null;
    this.contractForm.vehicleId = null;
    this.contractForm.purchasePrice = null;
    this.purchasePriceInput = '';
    this.salePriceInput = '';
    if (this.contractForm.vehicleId) {
      this.onVehicleSelectionChange(this.contractForm.vehicleId);
    }
  }

  onVehicleTypeChange(kind: VehicleKind): void {
    this.vehicleForm.vehicleType = kind;
    if (kind === VehicleKind.CAR) {
      this.vehicleForm.motorcycleType = '';
      this.vehicleSalePriceInput = '';
      return;
    }

    this.vehicleForm.bodyType = '';
    this.vehicleForm.fuelType = '';
    this.vehicleForm.numberOfDoors = null;
    this.vehicleSalePriceInput = '';
  }

  onVehicleSelectionChange(vehicleId: number | null): void {
    if (!this.isSaleType) {
      return;
    }

    if (!vehicleId) {
      this.contractForm.purchasePrice = null;
      this.purchasePriceInput = '';
      return;
    }

    if (this.salePurchaseCache.has(vehicleId)) {
      this.applyPrefilledPurchasePrice(this.salePurchaseCache.get(vehicleId)!);
      return;
    }

    const sub = this.purchaseSaleService.getByVehicleId(vehicleId).subscribe({
      next: (contracts) => {
        const sale = this.findRegisteredSale(contracts);
        if (sale) {
          this.showVehicleSoldWarning(vehicleId, sale.contractStatus);
          return;
        }
        const purchase = this.findEligiblePurchase(contracts);
        if (!purchase) {
          this.showVehicleSaleRestriction(vehicleId);
          return;
        }
        this.salePurchaseCache.set(vehicleId, purchase.purchasePrice);
        this.applyPrefilledPurchasePrice(purchase.purchasePrice);
      },
      error: (error) => {
        this.handleError(error, 'validar el vehículo seleccionado');
        this.contractForm.vehicleId = null;
      },
    });

    this.subscriptions.push(sub);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return this.currencyFormatter.format(value);
  }

  formatMileage(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return this.mileageFormatter.format(value);
  }

  onPriceInput(
    value: string,
    field: 'purchasePrice' | 'salePrice' | 'vehicleSalePrice',
  ): void {
    const numericValue = this.parseCurrencyInput(value);

    switch (field) {
      case 'purchasePrice':
        this.purchasePriceInput = value;
        this.contractForm.purchasePrice = numericValue;
        break;
      case 'salePrice':
        this.salePriceInput = value;
        this.contractForm.salePrice = numericValue;
        break;
      case 'vehicleSalePrice':
        this.vehicleSalePriceInput = value;
        this.vehicleForm.salePrice = numericValue;
        break;
    }
  }

  onMileageInput(value: string): void {
    const numericValue = this.parseCurrencyInput(value);
    if (numericValue === null) {
      this.vehicleForm.mileage = null;
      this.vehicleMileageInput = '';
      return;
    }
    const sanitized = Math.max(0, Math.floor(numericValue));
    this.vehicleForm.mileage = sanitized;
    this.vehicleMileageInput = this.formatMileage(sanitized);
  }

  showControlErrors(control: NgModel | null): boolean {
    if (!control) {
      return false;
    }
    return (
      !!control.invalid &&
      (control.touched || control.dirty || this.formSubmitted)
    );
  }

  resetContractForm(form?: NgForm, keepSelections = false): void {
    const selectedContractType = keepSelections
      ? this.contractForm.contractType
      : ContractType.PURCHASE;
    const selectedVehicleType = keepSelections
      ? this.vehicleForm.vehicleType
      : VehicleKind.CAR;

    form?.resetForm();
    this.contractForm = this.createDefaultContractForm(selectedContractType);
    this.vehicleForm = this.createDefaultVehicleForm(selectedVehicleType);
    this.purchasePriceInput = '';
    this.salePriceInput = '';
    this.vehicleSalePriceInput = '';
    this.vehicleMileageInput = '';
    this.formSubmitted = false;
  }

  getContractTypeLabel(type: ContractType): string {
    return this.typeLabels[type] ?? type;
  }

  getStatusLabel(status: ContractStatus): string {
    return this.statusLabels[status] ?? status;
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return this.paymentMethodLabels[method] ?? method;
  }

  private getVehicleLabelById(vehicleId: number): string | null {
    const option = this.vehicleMap().get(vehicleId);
    return option ? option.label : null;
  }

  private loadLookups(): void {
    this.isLoadingLookups.set(true);
    this.hasLookupError.set(false);

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

  private applyPrefilledPurchasePrice(value: number | null | undefined): void {
    const normalized = value ?? 0;
    this.contractForm.purchasePrice = normalized;
    this.purchasePriceInput = normalized ? normalized.toString() : '';
  }

  private findEligiblePurchase(contracts: PurchaseSale[]): PurchaseSale | null {
    const eligibleStatuses = new Set([
      ContractStatus.ACTIVE,
      ContractStatus.COMPLETED,
    ]);

    return (
      contracts
        .filter((contract) => contract.contractType === ContractType.PURCHASE)
        .filter((contract) => eligibleStatuses.has(contract.contractStatus))
        .sort(
          (a, b) =>
            (new Date(b.updatedAt ?? '').getTime() || 0) -
            (new Date(a.updatedAt ?? '').getTime() || 0),
        )[0] ?? null
    );
  }

  private findRegisteredSale(contracts: PurchaseSale[]): PurchaseSale | null {
    const blockingStatuses = new Set([
      ContractStatus.PENDING,
      ContractStatus.ACTIVE,
      ContractStatus.COMPLETED,
    ]);
    return (
      contracts.find(
        (contract) =>
          contract.contractType === ContractType.SALE &&
          blockingStatuses.has(contract.contractStatus),
      ) ?? null
    );
  }

  private showVehicleSaleRestriction(vehicleId: number): void {
    const label = this.getVehicleLabelById(vehicleId) ?? 'Este vehículo';
    void Swal.fire({
      icon: 'warning',
      title: 'Inventario no disponible',
      text: `${label} no cuenta con una compra activa o completada registrada.`,
    });
    this.contractForm.vehicleId = null;
    this.contractForm.purchasePrice = null;
    this.purchasePriceInput = '';
  }

  private showVehicleSoldWarning(
    vehicleId: number,
    status: ContractStatus,
  ): void {
    const label = this.getVehicleLabelById(vehicleId) ?? 'Este vehículo';
    const statusLabel = this.getStatusLabel(status);
    void Swal.fire({
      icon: 'warning',
      title: 'Venta ya registrada',
      text: `${label} ya tiene un contrato de venta en estado ${statusLabel}. No puedes registrar una nueva venta para este vehículo.`,
    });
    this.contractForm.vehicleId = null;
    this.contractForm.purchasePrice = null;
    this.purchasePriceInput = '';
  }

  private applyQueryParams(queryParams: ParamMap): void {
    const typeParam = queryParams.get('contractType');
    if (
      typeParam &&
      (Object.values(ContractType) as string[]).includes(typeParam)
    ) {
      this.onContractTypeChange(typeParam as ContractType);
    }

    const vehicleKindParam = queryParams.get('vehicleKind');
    if (
      vehicleKindParam &&
      (Object.values(VehicleKind) as string[]).includes(vehicleKindParam)
    ) {
      this.onVehicleTypeChange(vehicleKindParam as VehicleKind);
    }
  }

  private createDefaultContractForm(
    contractType: ContractType = ContractType.PURCHASE,
  ): ContractFormModel {
    return {
      clientId: null,
      userId: null,
      vehicleId: null,
      contractType,
      contractStatus: ContractStatus.PENDING,
      purchasePrice: null,
      salePrice: null,
      paymentLimitations: '',
      paymentTerms: '',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      observations: '',
    };
  }

  private createDefaultVehicleForm(
    vehicleType: VehicleKind = VehicleKind.CAR,
  ): VehicleFormModel {
    return {
      vehicleType,
      brand: '',
      model: '',
      capacity: null,
      line: '',
      plate: '',
      motorNumber: '',
      serialNumber: '',
      chassisNumber: '',
      color: '',
      cityRegistered: '',
      year: null,
      mileage: null,
      transmission: '',
      salePrice: null,
      photoUrl: '',
      bodyType: '',
      fuelType: '',
      numberOfDoors: null,
      motorcycleType: '',
    };
  }

  private parseCurrencyInput(value: string): number | null {
    if (!value) {
      return null;
    }
    const sanitized = value.replace(/\s+/g, '').replace(/[^0-9,\.]/g, '');
    if (!sanitized) {
      return null;
    }
    const normalized = sanitized.replace(/\./g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isNaN(numeric) ? null : numeric;
  }

  private buildVehiclePayload(): VehicleCreationPayload {
    const salePrice =
      this.vehicleForm.salePrice !== null &&
      this.vehicleForm.salePrice !== undefined
        ? Number(this.vehicleForm.salePrice)
        : undefined;
    const numberOfDoors =
      this.isCarSelected && this.vehicleForm.numberOfDoors !== null
        ? Number(this.vehicleForm.numberOfDoors)
        : undefined;
    const capacity = Number(this.vehicleForm.capacity ?? 0);
    const year = Number(this.vehicleForm.year ?? 0);
    const mileage = Number(this.vehicleForm.mileage ?? 0);

    return {
      vehicleType: this.vehicleForm.vehicleType,
      brand: this.trimValue(this.vehicleForm.brand),
      model: this.trimValue(this.vehicleForm.model),
      capacity,
      line: this.trimValue(this.vehicleForm.line),
      plate: this.trimValue(this.vehicleForm.plate).toUpperCase(),
      motorNumber: this.trimValue(this.vehicleForm.motorNumber),
      serialNumber: this.trimValue(this.vehicleForm.serialNumber),
      chassisNumber: this.trimValue(this.vehicleForm.chassisNumber),
      color: this.trimValue(this.vehicleForm.color),
      cityRegistered: this.trimValue(this.vehicleForm.cityRegistered),
      year,
      mileage,
      transmission: this.trimValue(this.vehicleForm.transmission),
      salePrice,
      photoUrl: this.trimValue(this.vehicleForm.photoUrl) || undefined,
      bodyType: this.isCarSelected
        ? this.trimValue(this.vehicleForm.bodyType)
        : undefined,
      fuelType: this.isCarSelected
        ? this.trimValue(this.vehicleForm.fuelType)
        : undefined,
      numberOfDoors,
      motorcycleType: this.isMotorcycleSelected
        ? this.trimValue(this.vehicleForm.motorcycleType)
        : undefined,
    };
  }

  private trimValue(value: string | null | undefined): string {
    return value ? value.trim() : '';
  }

  private showValidationError(): void {
    void Swal.fire({
      icon: 'warning',
      title: 'Formulario incompleto',
      text: 'Por favor, completa todos los campos obligatorios antes de continuar.',
    });
  }

  private showSuccessMessage(message: string): Promise<void> {
    return Swal.fire({
      icon: 'success',
      title: 'Operación exitosa',
      text: message,
      timer: 2200,
      showConfirmButton: false,
    }).then(() => undefined);
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
