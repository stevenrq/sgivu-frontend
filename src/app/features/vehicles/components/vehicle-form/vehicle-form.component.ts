import {
  Component,
  DestroyRef,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import { finalize, Observable } from 'rxjs';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import {
  VehicleFormType,
  VehicleFormControls,
  buildVehicleForm,
  applyVehicleTypeValidators,
} from '../../utils/vehicle-form-builder.utils';
import { VehicleImageManagerComponent } from '../vehicle-image-manager/vehicle-image-manager.component';
import { CarService } from '../../services/car.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import {
  formatCopNumber,
  normalizeMoneyInput,
} from '../../../../shared/utils/currency.utils';
import {
  showAlert,
  showErrorAlert,
  showSuccessAlert,
} from '../../../../shared/utils/swal-alert.utils';
import { showControlErrors } from '../../../../shared/utils/form.utils';
import {
  SubmitCopy,
  ViewCopy,
} from '../../../../shared/models/form-config.model';

type CarPayload = Omit<Car, 'id'> & Partial<Pick<Car, 'id'>>;
type MotorcyclePayload = Omit<Motorcycle, 'id'> &
  Partial<Pick<Motorcycle, 'id'>>;

/**
 * Formulario de registro y edición de vehículos (automóviles y motocicletas).
 * El tipo de vehículo (`CAR` | `MOTORCYCLE`) se determina por el dato `vehicleType` de la ruta.
 * Gestiona la carga de imágenes a S3 (presign → upload → confirm) y la eliminación de imágenes existentes.
 * Opera en modo creación o edición según la presencia del parámetro `id` en la ruta.
 */
@Component({
  selector: 'app-vehicle-form',
  imports: [
    ReactiveFormsModule,
    NgClass,
    FormShellComponent,
    VehicleImageManagerComponent,
  ],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly carService = inject(CarService);
  private readonly motorcycleService = inject(MotorcycleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  formGroup: FormGroup<VehicleFormControls> = buildVehicleForm(
    this.formBuilder,
  );
  readonly isEditMode = signal(false);
  readonly formSubmitted = signal(false);
  protected readonly showControlErrors = showControlErrors;
  readonly statuses = Object.values(VehicleStatus);
  readonly purchasePriceInput = signal('');
  readonly salePriceInput = signal('');
  readonly mileageInput = signal('');

  private readonly statusLabels: Record<VehicleStatus, string> = {
    [VehicleStatus.AVAILABLE]: 'Disponible',
    [VehicleStatus.SOLD]: 'Vendido',
    [VehicleStatus.IN_MAINTENANCE]: 'En mantenimiento',
    [VehicleStatus.IN_REPAIR]: 'En reparación',
    [VehicleStatus.IN_USE]: 'En uso',
    [VehicleStatus.INACTIVE]: 'Inactivo',
  };

  protected readonly vehicleId = signal<number | null>(null);
  private readonly vehicleType = signal<VehicleFormType>('CAR');
  readonly loading = signal(false);
  private readonly priceDecimals = 0;

  private readonly submitMessages: Record<VehicleFormType, SubmitCopy> = {
    CAR: {
      createSuccess: 'El vehículo fue registrado correctamente.',
      updateSuccess: 'El vehículo fue actualizado correctamente.',
      createError:
        'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
      updateError:
        'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
      redirectCommand: ['/vehicles/cars/page', 0],
    },
    MOTORCYCLE: {
      createSuccess: 'El vehículo fue registrado correctamente.',
      updateSuccess: 'El vehículo fue actualizado correctamente.',
      createError:
        'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
      updateError:
        'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
      redirectCommand: ['/vehicles/motorcycles/page', 0],
    },
  };

  private readonly viewCopyMap: Record<VehicleFormType, ViewCopy> = {
    CAR: {
      createTitle: 'Registrar automóvil',
      editTitle: 'Editar automóvil',
      createSubtitle: 'Completa los datos para registrar un nuevo automóvil.',
      editSubtitle: 'Actualiza la información del automóvil seleccionado.',
    },
    MOTORCYCLE: {
      createTitle: 'Registrar motocicleta',
      editTitle: 'Editar motocicleta',
      createSubtitle:
        'Completa los datos para registrar una nueva motocicleta.',
      editSubtitle: 'Actualiza la información de la motocicleta seleccionada.',
    },
  };

  readonly titleText = computed(() => {
    const copy = this.viewCopyMap[this.vehicleType()];
    return this.isEditMode() ? copy.editTitle : copy.createTitle;
  });

  readonly subtitleText = computed(() => {
    const copy = this.viewCopyMap[this.vehicleType()];
    return this.isEditMode() ? copy.editSubtitle : copy.createSubtitle;
  });

  readonly isCar = computed(() => this.vehicleType() === 'CAR');

  readonly isMotorcycle = computed(() => this.vehicleType() === 'MOTORCYCLE');

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.vehicleType.set(this.normalizeType(data['vehicleType']));
        applyVehicleTypeValidators(this.formGroup, this.vehicleType());
        this.formSubmitted.set(false);
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idParam = params.get('id');
        if (!idParam) {
          this.isEditMode.set(false);
          this.vehicleId.set(null);
          this.formGroup.enable();
          this.formSubmitted.set(false);
          return;
        }
        const id = Number(idParam);
        if (Number.isNaN(id)) {
          void showAlert({
            icon: 'error',
            title: 'Identificador inválido',
            text: 'El identificador proporcionado no es válido.',
          });
          void this.router.navigate(['/vehicles']);
          return;
        }
        this.vehicleId.set(id);
        this.isEditMode.set(true);
        this.loadVehicle(id);
      });
  }

  goBack(): void {
    const command =
      this.vehicleType() === 'CAR'
        ? ['/vehicles/cars/page', 0]
        : ['/vehicles/motorcycles/page', 0];
    void this.router.navigate(command);
  }

  getStatusLabel(status: VehicleStatus): string {
    return this.statusLabels[status] ?? status;
  }

  onSubmit(): void {
    this.formSubmitted.set(true);
    if (this.formGroup.invalid) {
      return;
    }

    this.loading.set(true);
    const request$: Observable<Car | Motorcycle> = this.isCar()
      ? (this.submitCar() as Observable<Car | Motorcycle>)
      : (this.submitMotorcycle() as Observable<Car | Motorcycle>);

    request$
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void showSuccessAlert(
            this.isEditMode()
              ? 'El vehículo fue actualizado correctamente.'
              : 'El vehículo fue registrado correctamente.',
          );
          let redirect: string[];
          if (this.isEditMode()) {
            redirect = this.isCar()
              ? ['/vehicles/cars/page', '0']
              : ['/vehicles/motorcycles/page', '0'];
          } else {
            redirect = ['/purchase-sales/registrar'];
          }
          const navigationExtras = this.isEditMode()
            ? undefined
            : {
                queryParams: {
                  contractType: ContractType.PURCHASE,
                  vehicleKind: this.vehicleType,
                },
              };
          void this.router.navigate(redirect, navigationExtras);
        },
        error: (error) => {
          if (error?.status === 409) {
            void showAlert({
              icon: 'warning',
              title: 'Datos duplicados',
              text: 'Ya existe un vehículo con la placa, número de motor, serial o chasis ingresado. Verifica que esos campos sean únicos.',
            });
            return;
          }
          void showErrorAlert(
            'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
          );
        },
      });
  }

  onPriceInput(
    field: 'purchasePrice' | 'salePrice',
    rawValue: string | null | undefined = '',
  ): void {
    const { numericValue, displayValue } = normalizeMoneyInput(
      rawValue ?? '',
      this.priceDecimals,
    );

    if (field === 'purchasePrice') {
      this.purchasePriceInput.set(displayValue);
      this.formGroup.controls.purchasePrice.setValue(numericValue);
      return;
    }

    this.salePriceInput.set(displayValue);
    this.formGroup.controls.salePrice.setValue(numericValue);
  }

  onMileageInput(rawValue: string | null | undefined = ''): void {
    const { numericValue, displayValue } = normalizeMoneyInput(
      rawValue ?? '',
      0,
    );
    this.mileageInput.set(displayValue);
    this.formGroup.controls.mileage.setValue(numericValue);
  }

  private submitCar() {
    const c = this.formGroup.controls;
    const payload: CarPayload = {
      id: this.vehicleId() ?? undefined,
      ...this.pickCommonFields(),
      bodyType: c.bodyType.value ?? '',
      fuelType: c.fuelType.value ?? '',
      numberOfDoors: Number(c.numberOfDoors.value ?? 4),
    };
    return this.isEditMode() && this.vehicleId()
      ? this.carService.update(this.vehicleId()!, payload as Car)
      : this.carService.create(payload as Car);
  }

  private submitMotorcycle() {
    const c = this.formGroup.controls;
    const payload: MotorcyclePayload = {
      id: this.vehicleId() ?? undefined,
      ...this.pickCommonFields(),
      motorcycleType: c.motorcycleType.value ?? '',
    };
    return this.isEditMode() && this.vehicleId()
      ? this.motorcycleService.update(this.vehicleId()!, payload as Motorcycle)
      : this.motorcycleService.create(payload as Motorcycle);
  }

  private pickCommonFields() {
    const c = this.formGroup.controls;
    return {
      brand: (c.brand.value ?? '').trim(),
      model: (c.model.value ?? '').trim(),
      capacity: Number(c.capacity.value ?? 0),
      line: (c.line.value ?? '').trim(),
      plate: (c.plate.value ?? '').trim().toUpperCase(),
      motorNumber: (c.motorNumber.value ?? '').trim(),
      serialNumber: (c.serialNumber.value ?? '').trim(),
      chassisNumber: (c.chassisNumber.value ?? '').trim(),
      color: (c.color.value ?? '').trim(),
      cityRegistered: (c.cityRegistered.value ?? '').trim(),
      year: Number(c.year.value ?? 0),
      mileage: Number(c.mileage.value ?? 0),
      transmission: (c.transmission.value ?? '').trim(),
      purchasePrice: Number(c.purchasePrice.value ?? 0),
      salePrice: Number(c.salePrice.value ?? 0),
      status: (c.status.value ?? VehicleStatus.AVAILABLE) as VehicleStatus,
      photoUrl: c.photoUrl.value ?? undefined,
    };
  }

  private loadVehicle(id: number): void {
    this.loading.set(true);
    const service$ = (
      this.vehicleType() === 'CAR'
        ? this.carService.getById(id)
        : this.motorcycleService.getById(id)
    ) as Observable<Car | Motorcycle>;

    service$
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (vehicle) => {
          this.patchVehicleForm(vehicle);
        },
        error: () => this.handleLoadError(),
      });
  }

  private patchVehicleForm(vehicle: Car | Motorcycle): void {
    this.formGroup.patchValue({ ...vehicle });
    this.purchasePriceInput.set(this.formatPriceInput(vehicle.purchasePrice));
    this.salePriceInput.set(this.formatPriceInput(vehicle.salePrice));
    this.mileageInput.set(this.formatMileage(vehicle.mileage));
  }

  private handleLoadError(): void {
    void showErrorAlert('Verifica el identificador e intenta nuevamente.');
    void this.router.navigate(['/vehicles']);
  }

  private formatPriceInput(value: number | null | undefined): string {
    return formatCopNumber(value, {
      minimumFractionDigits: this.priceDecimals,
      maximumFractionDigits: this.priceDecimals,
    });
  }

  private formatMileage(value: number | null | undefined): string {
    return formatCopNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  private normalizeType(raw: unknown): VehicleFormType {
    return raw === 'motorcycle' ? 'MOTORCYCLE' : 'CAR';
  }
}
