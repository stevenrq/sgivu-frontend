import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { parseUtcDate } from '../../../../shared/utils/date.utils';
import {
  formatCopCurrency,
  formatCopNumber,
  normalizeMoneyInput,
} from '../../../../shared/utils/currency.utils';
import {
  showAlert,
  showTimedSuccessAlert,
} from '../../../../shared/utils/swal-alert.utils';
import { showHttpError } from '../../../../shared/utils/error-handler.utils';
import { showControlErrors } from '../../../../shared/utils/form.utils';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
import { PurchaseSaleLookupService } from '../../services/purchase-sale-lookup.service';
import { PurchaseSale } from '../../models/purchase-sale.model';
import { ContractType } from '../../models/contract-type.enum';
import { ContractStatus } from '../../models/contract-status.enum';
import { PaymentMethod } from '../../models/payment-method.enum';
import { VehicleKind } from '../../models/vehicle-kind.enum';
import { VehicleStatus } from '../../../vehicles/models/vehicle-status.enum';
import {
  ContractFormControls,
  VehicleFormControls,
  buildContractFormGroup,
  buildVehicleFormGroup,
  applyContractTypeValidators,
  applyVehicleTypeValidators,
} from '../../models/purchase-sale-form.model';
import {
  getStatusLabel,
  getContractTypeLabel,
  getPaymentMethodLabel,
} from '../../models/contract-labels';
import { PurchaseVehicleFormComponent } from '../purchase-vehicle-form/purchase-vehicle-form.component';

/**
 * Componente de registro y edición de contratos de compra-venta.
 * Maneja un formulario multi-sección: datos del contrato (cliente, usuario, vehículo existente o nuevo,
 * método de pago, precios y fechas) y sección condicional de nuevo vehículo (delegada a `PurchaseVehicleFormComponent`).
 * Preselecciona el tipo de contrato y el tipo de vehículo vía query params al navegar desde el inventario.
 */
@Component({
  selector: 'app-purchase-sale-create',
  imports: [
    ReactiveFormsModule,
    HasPermissionDirective,
    KpiCardComponent,
    FormShellComponent,
    PurchaseVehicleFormComponent,
  ],
  templateUrl: './purchase-sale-create.component.html',
  styleUrl: './purchase-sale-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseSaleCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly lookupService = inject(PurchaseSaleLookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly vehicleFormComp = viewChild(PurchaseVehicleFormComponent);

  readonly contractStatuses = Object.values(ContractStatus);
  readonly paymentMethods = Object.values(PaymentMethod);
  readonly contractTypes = Object.values(ContractType);
  readonly ContractStatus = ContractStatus;
  readonly ContractType = ContractType;

  contractFormGroup: FormGroup<ContractFormControls> = buildContractFormGroup(
    this.fb,
  );
  vehicleFormGroup: FormGroup<VehicleFormControls> = buildVehicleFormGroup(
    this.fb,
  );

  readonly formSubmitted = signal(false);
  protected readonly showControlErrors = showControlErrors;

  // Estos signals almacenan las representaciones formateadas de los precios de compra y venta
  // para mostrarlos en los inputs personalizados.
  readonly purchasePriceInput = signal('');
  readonly salePriceInput = signal('');

  readonly formLoading = signal(false);

  readonly clients = this.lookupService.clients;
  readonly users = this.lookupService.users;
  readonly vehicles = this.lookupService.vehicles;

  readonly isLoadingLookups = signal(false);
  readonly hasLookupError = signal(false);

  readonly summaryState = signal({ total: 0, purchases: 0, sales: 0 });

  readonly availableVehicles = computed(() =>
    this.vehicles().filter((v) => v.status === VehicleStatus.AVAILABLE),
  );

  private readonly priceDecimals = 0;

  /**
   * Cache que almacena tanto el precio de compra como el precio de venta más reciente para cada vehículo.
   * Clave: ID del vehículo | Valor: Precio de compra y precio de venta del vehículo en COP
   */
  private readonly vehiclePurchaseAndSalePriceCache = new Map<
    number,
    { purchasePrice: number; salePrice: number | null }
  >();

  readonly getStatusLabel = getStatusLabel;
  readonly getContractTypeLabel = getContractTypeLabel;
  readonly getPaymentMethodLabel = getPaymentMethodLabel;

  get isPurchaseType(): boolean {
    return (
      this.contractFormGroup.controls.contractType.value ===
      ContractType.PURCHASE
    );
  }

  get isSaleType(): boolean {
    return (
      this.contractFormGroup.controls.contractType.value === ContractType.SALE
    );
  }

  ngOnInit(): void {
    this.loadLookups();
    this.refreshSummary();

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyQueryParams(params));
  }

  submitContract(): void {
    this.formSubmitted.set(true);
    if (this.contractFormGroup.invalid) {
      this.showValidationError();
      return;
    }

    if (this.isPurchaseType && this.vehicleFormGroup.invalid) {
      this.showValidationError();
      return;
    }

    const formValue = this.contractFormGroup.getRawValue();
    const purchasePrice = formValue.purchasePrice;
    const salePrice = this.isSaleType
      ? formValue.salePrice
      : this.vehicleFormGroup.controls.salePrice.value;
    if (!this.isPriceInputValid(purchasePrice, salePrice)) {
      this.showPriceError();
      return;
    }

    const payload: PurchaseSale = {
      clientId: Number(formValue.clientId),
      userId: Number(formValue.userId),
      purchasePrice: purchasePrice ?? 0,
      salePrice: salePrice ?? 0,
      contractStatus: formValue.contractStatus!,
      contractType: formValue.contractType,
      paymentLimitations: formValue.paymentLimitations.trim(),
      paymentTerms: formValue.paymentTerms.trim(),
      paymentMethod: formValue.paymentMethod!,
      observations: formValue.observations?.trim() ?? null,
    };

    if (this.isSaleType) {
      payload.vehicleId = Number(formValue.vehicleId);
    } else {
      payload.vehicleData = this.vehicleFormComp()?.buildPayload();
    }

    this.formLoading.set(true);
    this.purchaseSaleService
      .create(payload)
      .pipe(
        finalize(() => this.formLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.resetContractForm(true);
          this.vehiclePurchaseAndSalePriceCache.clear();
          this.refreshSummary();
          void this.router.navigate(['/purchase-sales/page', 0]).then(() => {
            void showTimedSuccessAlert('Contrato registrado con éxito.');
          });
        },
        error: (error) => this.handleError(error, 'registrar el contrato'),
      });
  }

  onContractTypeChange(type: ContractType): void {
    this.formSubmitted.set(false);
    this.contractFormGroup.controls.contractType.setValue(type);
    applyContractTypeValidators(this.contractFormGroup, type);
    this.contractFormGroup.controls.salePrice.reset(null, { emitEvent: false });
    this.contractFormGroup.controls.vehicleId.reset(null, { emitEvent: false });
    this.contractFormGroup.controls.purchasePrice.reset(null, {
      emitEvent: false,
    });
    this.purchasePriceInput.set('');
    this.salePriceInput.set('');
  }

  onVehicleSelectionChange(vehicleId: number | null): void {
    if (!this.isSaleType) return;

    if (!vehicleId) {
      this.contractFormGroup.controls.purchasePrice.setValue(null);
      this.purchasePriceInput.set('');
      return;
    }

    if (this.vehiclePurchaseAndSalePriceCache.has(vehicleId)) {
      this.applyPrefilledPurchaseAndSalePrice(
        this.vehiclePurchaseAndSalePriceCache.get(vehicleId) ?? {
          purchasePrice: 0,
          salePrice: 0,
        },
      );
      return;
    }

    this.purchaseSaleService
      .getByVehicleId(vehicleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

          this.vehiclePurchaseAndSalePriceCache.set(vehicleId, {
            purchasePrice: purchase.purchasePrice,
            salePrice: purchase.salePrice,
          });
          this.applyPrefilledPurchaseAndSalePrice({
            purchasePrice: purchase.purchasePrice,
            salePrice: purchase.salePrice,
          });
        },
        error: (error) => {
          this.handleError(error, 'validar el vehículo seleccionado');
          this.contractFormGroup.controls.vehicleId.setValue(null);
        },
      });
  }

  formatCurrency(value: number | null | undefined): string {
    return formatCopCurrency(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  onPriceInput(value: string, field: 'purchasePrice' | 'salePrice'): void {
    const { numericValue, displayValue } = normalizeMoneyInput(
      value,
      this.priceDecimals,
    );

    if (field === 'purchasePrice') {
      this.purchasePriceInput.set(displayValue);
      this.contractFormGroup.controls.purchasePrice.setValue(numericValue);
    } else {
      this.salePriceInput.set(displayValue);
      this.contractFormGroup.controls.salePrice.setValue(numericValue);
    }
  }

  resetContractForm(keepSelections = false): void {
    this.formSubmitted.set(false);
    const selectedContractType = keepSelections
      ? this.contractFormGroup.controls.contractType.value
      : ContractType.PURCHASE;
    const selectedVehicleType = keepSelections
      ? this.vehicleFormGroup.controls.vehicleType.value
      : VehicleKind.CAR;

    this.contractFormGroup = buildContractFormGroup(
      this.fb,
      selectedContractType,
    );
    this.vehicleFormGroup = buildVehicleFormGroup(this.fb, selectedVehicleType);
    this.purchasePriceInput.set('');
    this.salePriceInput.set('');
    this.vehicleFormComp()?.resetDisplayInputs();
  }

  private loadLookups(): void {
    this.isLoadingLookups.set(true);
    this.hasLookupError.set(false);

    this.lookupService.loadAll(
      this.destroyRef,
      (err) => {
        this.hasLookupError.set(true);
        this.handleError(err, 'cargar la información auxiliar');
      },
      () => this.isLoadingLookups.set(false),
    );
  }

  private refreshSummary(): void {
    this.purchaseSaleService
      .getAll()
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
        },
        error: () =>
          this.summaryState.set({ total: 0, purchases: 0, sales: 0 }),
      });
  }

  private applyPrefilledPurchaseAndSalePrice(prices: {
    purchasePrice: number;
    salePrice: number | null;
  }): void {
    this.contractFormGroup.controls.purchasePrice.setValue(
      prices.purchasePrice,
    );
    this.purchasePriceInput.set(
      formatCopNumber(prices.purchasePrice, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    );

    if (this.isSaleType && prices.salePrice !== null) {
      this.contractFormGroup.controls.salePrice.setValue(prices.salePrice);
      this.salePriceInput.set(
        formatCopNumber(prices.salePrice, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      );
    } else if (this.isSaleType && prices.salePrice === null) {
      this.contractFormGroup.controls.salePrice.setValue(null);
      this.salePriceInput.set('');
    }
  }

  /**
   * Busca la compra más reciente con estado activo o completado para un vehículo dado.
   * @param contracts Lista de contratos asociados al vehículo seleccionado
   * @returns El contrato de compra elegible o null si no se encuentra ninguno
   */
  private findEligiblePurchase(contracts: PurchaseSale[]): PurchaseSale | null {
    const eligibleStatuses = new Set([
      ContractStatus.ACTIVE,
      ContractStatus.COMPLETED,
    ]);

    return (
      contracts
        .filter((c) => c.contractType === ContractType.PURCHASE)
        .filter((c) => eligibleStatuses.has(c.contractStatus))
        .sort(
          (a, b) =>
            (parseUtcDate(b.updatedAt ?? '')?.getTime() ?? 0) -
            (parseUtcDate(a.updatedAt ?? '')?.getTime() ?? 0),
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
        (c) =>
          c.contractType === ContractType.SALE &&
          blockingStatuses.has(c.contractStatus),
      ) ?? null
    );
  }

  private showVehicleSaleRestriction(vehicleId: number): void {
    const label = this.getVehicleLabelById(vehicleId);
    void showAlert({
      icon: 'warning',
      title: 'Inventario no disponible',
      text: `${label} no cuenta con una compra activa o completada registrada.`,
    });
    this.contractFormGroup.controls.vehicleId.setValue(null);
    this.contractFormGroup.controls.purchasePrice.setValue(null);
    this.purchasePriceInput.set('');
  }

  private showVehicleSoldWarning(
    vehicleId: number,
    status: ContractStatus,
  ): void {
    const label = this.getVehicleLabelById(vehicleId);
    const statusLabel = getStatusLabel(status);
    void showAlert({
      icon: 'warning',
      title: 'Venta ya registrada',
      text: `${label} ya tiene un contrato de venta en estado ${statusLabel}. No puedes registrar una nueva venta para este vehículo.`,
    });
    this.contractFormGroup.controls.vehicleId.setValue(null);
    this.contractFormGroup.controls.purchasePrice.setValue(null);
    this.purchasePriceInput.set('');
  }

  private showValidationError(): void {
    void showAlert({
      icon: 'warning',
      title: 'Formulario incompleto',
      text: 'Por favor, completa todos los campos obligatorios antes de continuar.',
    });
  }

  private showPriceError(): void {
    void showAlert({
      icon: 'warning',
      title: 'Precios inválidos',
      text: 'El precio de compra y el precio de venta deben ser valores en COP mayores a cero.',
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
      this.vehicleFormGroup.controls.vehicleType.setValue(
        vehicleKindParam as VehicleKind,
      );
      applyVehicleTypeValidators(
        this.vehicleFormGroup,
        vehicleKindParam as VehicleKind,
      );
    }
  }

  private isPriceInputValid(
    purchasePrice: number | null | undefined,
    salePrice: number | null | undefined,
  ): boolean {
    if (!purchasePrice || purchasePrice <= 0) return false;
    if (this.isSaleType) return !!salePrice && salePrice > 0;
    if (salePrice !== null && salePrice !== undefined && salePrice < 0)
      return false;
    return true;
  }

  private getVehicleLabelById(vehicleId: number): string {
    const option = this.lookupService.vehicleMap().get(vehicleId);
    return option ? option.label : 'Este vehículo';
  }

  private decorateVehicleMessage(message: string | null): string {
    if (!message) return '';
    return message.replaceAll(/veh[ií]culo con id (\d+)/gi, (_, id: string) => {
      const label = this.getVehicleLabelById(Number(id));
      return label ?? `vehículo con id ${id}`;
    });
  }
}
