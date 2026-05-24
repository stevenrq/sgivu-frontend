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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import { finalize, Observable } from 'rxjs';
import {
  lengthValidator,
  textFieldValidators,
} from '../../../../shared/validators/form.validator';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { CarService } from '../../services/car.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { VehicleImageService } from '../../services/vehicle-image.service';
import { VehicleImageUploadService } from '../../services/vehicle-image-upload.service';
import { VehicleImageResponse } from '../../models/vehicle-image-response';
import {
  formatCopNumber,
  normalizeMoneyInput,
} from '../../../../shared/utils/currency.utils';
import {
  showAlert,
  showErrorAlert,
  showSuccessAlert,
  showConfirmDialog,
} from '../../../../shared/utils/swal-alert.utils';
import { showControlErrors } from '../../../../shared/utils/form.utils';
import {
  SubmitCopy,
  ViewCopy,
} from '../../../../shared/models/form-config.model';

type VehicleFormType = 'CAR' | 'MOTORCYCLE';

interface VehicleFormControls {
  brand: FormControl<string | null>;
  model: FormControl<string | null>;
  capacity: FormControl<number | null>;
  line: FormControl<string | null>;
  plate: FormControl<string | null>;
  motorNumber: FormControl<string | null>;
  serialNumber: FormControl<string | null>;
  chassisNumber: FormControl<string | null>;
  color: FormControl<string | null>;
  cityRegistered: FormControl<string | null>;
  year: FormControl<number | null>;
  mileage: FormControl<number | null>;
  transmission: FormControl<string | null>;
  purchasePrice: FormControl<number | null>;
  salePrice: FormControl<number | null>;
  status: FormControl<VehicleStatus | null>;
  photoUrl: FormControl<string | null>;
  bodyType: FormControl<string | null>;
  fuelType: FormControl<string | null>;
  numberOfDoors: FormControl<number | null>;
  motorcycleType: FormControl<string | null>;
}

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
  imports: [ReactiveFormsModule, NgClass, DecimalPipe, FormShellComponent],
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
  private readonly vehicleImageService = inject(VehicleImageService);
  private readonly imageUploadService = inject(VehicleImageUploadService);
  private readonly destroyRef = inject(DestroyRef);

  formGroup: FormGroup<VehicleFormControls> = this.buildForm();
  readonly isEditMode = signal(false);
  readonly formSubmitted = signal(false);
  protected readonly showControlErrors = showControlErrors;
  readonly statuses = Object.values(VehicleStatus);
  readonly vehicleImages = signal<VehicleImageResponse[]>([]);

  readonly selectedFiles = signal<File[]>([]);
  readonly previewUrl = signal<string | null>(null);
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

  private readonly vehicleId = signal<number | null>(null);
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
        this.applyTypeSpecificValidators();
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

  onImageSelected(event: Event): void {
    const result = this.imageUploadService.processFileSelection(event);
    if (!result) {
      this.selectedFiles.set([]);
      this.previewUrl.set(null);
      return;
    }

    const currentPreview = this.previewUrl();
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    this.selectedFiles.set(result.files);
    this.previewUrl.set(result.previewUrl);
  }

  async uploadSelectedImage(): Promise<void> {
    if (!this.vehicleId()) return;

    this.loading.set(true);
    const { success } = await this.imageUploadService.uploadFiles(
      this.vehicleId()!,
      this.selectedFiles(),
      this.vehicleImages(),
    );
    this.loading.set(false);

    if (success) {
      this.selectedFiles.set([]);
      const currentPreview = this.previewUrl();
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      this.previewUrl.set(null);
      this.loadVehicleImages(this.vehicleId()!);
    }
  }

  removeSelectedFile(index: number): void {
    const files = this.selectedFiles();
    if (index < 0 || index >= files.length) return;
    const updated = files.filter((_, i) => i !== index);
    this.selectedFiles.set(updated);
    const currentPreview = this.previewUrl();
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
      this.previewUrl.set(updated[0] ? URL.createObjectURL(updated[0]) : null);
    }
  }

  async deleteImage(imageId: number): Promise<void> {
    if (!this.vehicleId()) return;

    const result = await showConfirmDialog({
      title: 'Eliminar imagen',
      text: '¿Estás seguro de eliminar esta imagen?',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    const deleted = await this.imageUploadService.deleteImage(
      this.vehicleId()!,
      imageId,
    );
    if (deleted) {
      this.loadVehicleImages(this.vehicleId()!);
    }
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
          this.loadVehicleImages(id);
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

  private buildForm(): FormGroup<VehicleFormControls> {
    return this.formBuilder.group<VehicleFormControls>({
      brand: new FormControl('', textFieldValidators(2, 20)),
      model: new FormControl('', textFieldValidators(1, 20)),
      capacity: new FormControl(null, [Validators.required, Validators.min(1)]),
      line: new FormControl('', textFieldValidators(1, 20)),
      plate: new FormControl('', [
        Validators.required,
        lengthValidator(5, 10),
        Validators.pattern(/^[A-Z0-9-]+$/i),
      ]),
      motorNumber: new FormControl('', textFieldValidators(5, 30)),
      serialNumber: new FormControl('', textFieldValidators(5, 30)),
      chassisNumber: new FormControl('', textFieldValidators(5, 30)),
      color: new FormControl('', textFieldValidators(3, 20)),
      cityRegistered: new FormControl('', textFieldValidators(3, 30)),
      year: new FormControl(null, [
        Validators.required,
        Validators.min(1950),
        Validators.max(2050),
      ]),
      mileage: new FormControl(null, [Validators.required, Validators.min(0)]),
      transmission: new FormControl('', textFieldValidators(3, 20)),
      purchasePrice: new FormControl(null, [
        Validators.required,
        Validators.min(0),
      ]),
      salePrice: new FormControl(null, [Validators.min(0)]),
      status: new FormControl(VehicleStatus.AVAILABLE, Validators.required),
      photoUrl: new FormControl(''),
      bodyType: new FormControl(''),
      fuelType: new FormControl(''),
      numberOfDoors: new FormControl(4),
      motorcycleType: new FormControl(''),
    });
  }

  private applyTypeSpecificValidators(): void {
    const { bodyType, fuelType, numberOfDoors, motorcycleType } =
      this.formGroup.controls;

    if (this.vehicleType() === 'CAR') {
      bodyType.setValidators(textFieldValidators(3, 20));
      fuelType.setValidators(textFieldValidators(3, 20));
      numberOfDoors.setValidators([
        Validators.required,
        Validators.min(2),
        Validators.max(6),
      ]);
      motorcycleType.clearValidators();
      motorcycleType.reset('');
    } else {
      motorcycleType.setValidators(textFieldValidators(3, 20));
      bodyType.clearValidators();
      fuelType.clearValidators();
      numberOfDoors.clearValidators();
      bodyType.reset('');
      fuelType.reset('');
      numberOfDoors.reset(null);
    }

    bodyType.updateValueAndValidity();
    fuelType.updateValueAndValidity();
    numberOfDoors.updateValueAndValidity();
    motorcycleType.updateValueAndValidity();
  }

  private normalizeType(raw: unknown): VehicleFormType {
    return raw === 'motorcycle' ? 'MOTORCYCLE' : 'CAR';
  }

  private loadVehicleImages(vehicleId: number): void {
    this.vehicleImageService
      .getImages(vehicleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (images) => this.vehicleImages.set(images),
        error: () => console.error('Failed to load images'),
      });
  }
}
