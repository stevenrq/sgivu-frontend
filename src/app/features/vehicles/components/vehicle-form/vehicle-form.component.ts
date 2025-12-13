import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, NgClass, NgForOf, NgIf } from '@angular/common';
import { finalize, firstValueFrom, Observable, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import {
  lengthValidator,
  noWhitespaceValidator,
} from '../../../../shared/validators/form.validator';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { CarService } from '../../services/car.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { VehicleImageService } from '../../services/vehicle-image.service';
import { VehicleImageResponse } from '../../models/vehicle-image-response';
import {
  formatCopNumber,
  normalizeMoneyInput,
} from '../../../../shared/utils/currency.utils';

type VehicleFormType = 'CAR' | 'MOTORCYCLE';

type CarPayload = Omit<Car, 'id'> & Partial<Pick<Car, 'id'>>;
type MotorcyclePayload = Omit<Motorcycle, 'id'> &
  Partial<Pick<Motorcycle, 'id'>>;

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgIf, NgForOf, DecimalPipe],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.css',
})
/**
 * Orquesta el registro y edición de automóviles y motocicletas. Ajusta
 * dinámicamente validaciones, payloads y navegación según el tipo de vehículo,
 * además de coordinar la carga de imágenes y las operaciones de guardado.
 *
 * @remarks
 * Es el formulario principal del módulo de vehículos y, por tanto, concentra
 * las reglas compartidas entre autos y motos.
 */
export class VehicleFormComponent implements OnInit, OnDestroy {
  formGroup: FormGroup;
  isEditMode = false;
  readonly statuses = Object.values(VehicleStatus);
  readonly vehicleImages = signal<VehicleImageResponse[]>([]);

  selectedFiles: File[] = [];
  previewUrl: string | null = null;
  purchasePriceInput = '';
  salePriceInput = '';
  mileageInput = '';

  private readonly statusLabels: Record<VehicleStatus, string> = {
    [VehicleStatus.AVAILABLE]: 'Disponible',
    [VehicleStatus.SOLD]: 'Vendido',
    [VehicleStatus.IN_MAINTENANCE]: 'En mantenimiento',
    [VehicleStatus.IN_REPAIR]: 'En reparación',
    [VehicleStatus.IN_USE]: 'En uso',
    [VehicleStatus.INACTIVE]: 'Inactivo',
  };

  private vehicleId: number | null = null;
  private vehicleType: VehicleFormType = 'CAR';
  private readonly subscriptions: Subscription[] = [];
  private readonly loadingSignal = signal<boolean>(false);
  readonly isLoading = computed(() => this.loadingSignal());
  private readonly priceDecimals = 0;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly vehicleImageService: VehicleImageService,
  ) {
    this.formGroup = this.buildForm();
  }

  get titleText(): string {
    if (this.vehicleType === 'CAR') {
      return this.isEditMode ? 'Editar automóvil' : 'Registrar automóvil';
    }
    return this.isEditMode ? 'Editar motocicleta' : 'Registrar motocicleta';
  }

  get subtitleText(): string {
    if (this.vehicleType === 'CAR') {
      return this.isEditMode
        ? 'Actualiza la información del automóvil seleccionado.'
        : 'Completa los datos para registrar un nuevo automóvil.';
    }
    return this.isEditMode
      ? 'Actualiza la información de la motocicleta seleccionada.'
      : 'Completa los datos para registrar una nueva motocicleta.';
  }

  get isCar(): boolean {
    return this.vehicleType === 'CAR';
  }

  get isMotorcycle(): boolean {
    return this.vehicleType === 'MOTORCYCLE';
  }

  ngOnInit(): void {
    const dataSub = this.route.data.subscribe((data) => {
      this.vehicleType = this.normalizeType(data['vehicleType']);
      this.applyTypeSpecificValidators();
    });

    const paramSub = this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (!idParam) {
        this.isEditMode = false;
        this.vehicleId = null;
        this.formGroup.enable();
        return;
      }
      const id = Number(idParam);
      if (Number.isNaN(id)) {
        void Swal.fire({
          icon: 'error',
          title: 'Identificador inválido',
          text: 'El identificador proporcionado no es válido.',
        });
        void this.router.navigate(['/vehicles']);
        return;
      }
      this.vehicleId = id;
      this.isEditMode = true;
      this.loadVehicle(id);
    });

    this.subscriptions.push(dataSub, paramSub);
  }

  goBack(): void {
    const command =
      this.vehicleType === 'CAR'
        ? ['/vehicles/cars/page', 0]
        : ['/vehicles/motorcycles/page', 0];
    void this.router.navigate(command);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  getStatusLabel(status: VehicleStatus): string {
    return this.statusLabels[status] ?? status;
  }

  /**
   * Valida el formulario y dirige la petición al servicio correspondiente,
   * mostrando mensajes de estado y redirigiendo según si se trata de una
   * creación o edición. La lógica centralizada evita duplicar flujos por tipo.
   */
  onSubmit(): void {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.loadingSignal.set(true);
    const request: Observable<Car | Motorcycle> = this.isCar
      ? (this.submitCar() as Observable<Car | Motorcycle>)
      : (this.submitMotorcycle() as Observable<Car | Motorcycle>);

    const sub = request
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Operación exitosa',
            text: this.isEditMode
              ? 'El vehículo fue actualizado correctamente.'
              : 'El vehículo fue registrado correctamente.',
          });
          const redirect = this.isEditMode
            ? this.isCar
              ? ['/vehicles/cars/page', 0]
              : ['/vehicles/motorcycles/page', 0]
            : ['/purchase-sales/registrar'];
          const navigationExtras = this.isEditMode
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
            void Swal.fire({
              icon: 'warning',
              title: 'Datos duplicados',
              text: 'Ya existe un vehículo con la placa, número de motor, serial o chasis ingresado. Verifica que esos campos sean únicos.',
            });
            return;
          }

          void Swal.fire({
            icon: 'error',
            title: 'Error al guardar el vehículo',
            text: 'Ocurrió un problema al procesar la solicitud. Intenta nuevamente.',
          });
        },
      });

    this.subscriptions.push(sub);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.selectedFiles = [];
      this.previewUrl = null;
      return;
    }

    const files = Array.from(input.files);

    const onlyImages = files.filter((f) => f.type.startsWith('image/'));
    if (onlyImages.length !== files.length) {
      void Swal.fire({
        icon: 'warning',
        title: 'Archivo no válido',
        text: 'Por favor selecciona imágenes (JPEG, PNG, WEBP).',
      });
      this.selectedFiles = [];
      this.previewUrl = null;
      input.value = '';
      return;
    }

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.selectedFiles = onlyImages;
    this.previewUrl = URL.createObjectURL(onlyImages[0]);
  }

  uploadSelectedImage(): void {
    if (!this.selectedFiles.length || !this.vehicleId) {
      void Swal.fire({
        icon: 'info',
        title: 'Sin imagen seleccionada',
        text: 'Selecciona una o varias imágenes antes de subirlas.',
      });
      return;
    }

    const files = this.selectedFiles;
    const hasImages = this.vehicleImages().length > 0;
    this.loadingSignal.set(true);

    const uploadFile = async (
      file: File,
      attempt: number,
      primary: boolean,
    ): Promise<void> => {
      const contentType = this.resolveContentType(file);
      try {
        const presigned = await firstValueFrom(
          this.vehicleImageService.createPresignedUploadUrl(
            this.vehicleId!,
            contentType,
          ),
        );

        await firstValueFrom(
          this.vehicleImageService.uploadToPresignedUrl(
            presigned.uploadUrl,
            file,
            contentType,
          ),
        );

        await firstValueFrom(
          this.vehicleImageService.confirmUpload(this.vehicleId!, {
            fileName: file.name,
            contentType,
            size: file.size,
            key: presigned.key,
            primary,
          }),
        );
      } catch (err: any) {
        if (attempt === 1 && this.shouldRetryUpload(err)) {
          return uploadFile(file, 2, primary);
        }
        throw err;
      }
    };

    (async () => {
      try {
        const currentCount = this.vehicleImages().length;
        for (let idx = 0; idx < files.length; idx++) {
          const primary = !hasImages && idx === 0 && currentCount === 0;
          await uploadFile(files[idx], 1, primary);
        }

        void Swal.fire({
          icon: 'success',
          title: 'Imágenes subidas',
          text: 'Las imágenes se han almacenado correctamente.',
        });
        this.selectedFiles = [];
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        this.loadVehicleImages(this.vehicleId!);
      } catch (error: any) {
        const s3Message =
          typeof error?.error === 'string' && error.error.startsWith('<?xml')
            ? 'El enlace de subida expiró o la firma no es válida. Genera una nueva URL e inténtalo de nuevo.'
            : '';
        const duplicateMessage =
          typeof error?.error === 'string' &&
          (error.error.includes(
            'Ya existe una imagen con el mismo nombre de archivo',
          ) ||
            error.error.includes(
              'Ya existe una imagen registrada con esta clave',
            ))
            ? 'Ya existe una imagen con ese nombre o clave para este vehículo.'
            : '';
        const text =
          error?.status === 0
            ? 'No se pudo contactar con el bucket de almacenamiento. Verifica la conexión y la configuración de CORS.'
            : duplicateMessage ||
              s3Message ||
              'Ocurrió un problema al subir la imagen. Intenta nuevamente.';

        void Swal.fire({
          icon: 'error',
          title: 'Error al subir la imagen',
          text,
        });
      } finally {
        this.loadingSignal.set(false);
      }
    })();
  }

  removeSelectedFile(index: number): void {
    if (index < 0 || index >= this.selectedFiles.length) return;
    this.selectedFiles.splice(index, 1);
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = this.selectedFiles[0]
        ? URL.createObjectURL(this.selectedFiles[0])
        : null;
    }
  }

  deleteImage(imageId: number): void {
    if (!this.vehicleId) {
      return;
    }

    void Swal.fire({
      icon: 'warning',
      title: 'Eliminar imagen',
      text: '¿Estás seguro de eliminar esta imagen?',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const sub = this.vehicleImageService
        .deleteImage(this.vehicleId!, imageId)
        .subscribe({
          next: () => {
            this.loadVehicleImages(this.vehicleId!);
          },
          error: () => {
            void Swal.fire({
              icon: 'error',
              title: 'No se pudo eliminar',
              text: 'Ocurrió un problema al eliminar la imagen.',
            });
          },
        });

      this.subscriptions.push(sub);
    });
  }

  /**
   * Construye el payload de automóvil reutilizando los campos comunes y
   * decide si debe invocar `create` o `update` en función del modo actual.
   * Regresa un observable para que el flujo principal maneje loading y errores.
   *
   * @returns Observable con la respuesta del servicio de automóviles.
   */
  private submitCar() {
    const payload: CarPayload = {
      id: this.vehicleId ?? undefined,
      ...this.pickCommonFields(),
      bodyType: this.formGroup.get('bodyType')!.value ?? '',
      fuelType: this.formGroup.get('fuelType')!.value ?? '',
      numberOfDoors: Number(this.formGroup.get('numberOfDoors')!.value ?? 4),
    };
    return this.isEditMode && this.vehicleId
      ? this.carService.update(this.vehicleId, payload as Car)
      : this.carService.create(payload as Car);
  }

  /**
   * Equivalente a `submitCar` pero para motocicletas. Se asegura de enviar sólo
   * los campos relevantes para este tipo y reutiliza la misma salida observable
   * para simplificar la lógica de `onSubmit`.
   *
   * @returns Observable con la respuesta del servicio de motocicletas.
   */
  private submitMotorcycle() {
    const payload: MotorcyclePayload = {
      id: this.vehicleId ?? undefined,
      ...this.pickCommonFields(),
      motorcycleType: this.formGroup.get('motorcycleType')!.value ?? '',
    };
    return this.isEditMode && this.vehicleId
      ? this.motorcycleService.update(this.vehicleId, payload as Motorcycle)
      : this.motorcycleService.create(payload as Motorcycle);
  }

  /**
   * Extrae y normaliza los campos que comparten autos y motos (trims,
   * uppercases y conversiones numéricas) para que los payloads específicos no
   * repitan esta lógica ni dependan del estado crudo del formulario reactivo.
   *
   * @returns Objeto con los campos comunes listo para componer los payloads.
   */
  private pickCommonFields() {
    return {
      brand: (this.formGroup.get('brand')!.value ?? '').trim(),
      model: (this.formGroup.get('model')!.value ?? '').trim(),
      capacity: Number(this.formGroup.get('capacity')!.value ?? 0),
      line: (this.formGroup.get('line')!.value ?? '').trim(),
      plate: (this.formGroup.get('plate')!.value ?? '').trim().toUpperCase(),
      motorNumber: (this.formGroup.get('motorNumber')!.value ?? '').trim(),
      serialNumber: (this.formGroup.get('serialNumber')!.value ?? '').trim(),
      chassisNumber: (this.formGroup.get('chassisNumber')!.value ?? '').trim(),
      color: (this.formGroup.get('color')!.value ?? '').trim(),
      cityRegistered: (
        this.formGroup.get('cityRegistered')!.value ?? ''
      ).trim(),
      year: Number(this.formGroup.get('year')!.value ?? 0),
      mileage: Number(this.formGroup.get('mileage')!.value ?? 0),
      transmission: (this.formGroup.get('transmission')!.value ?? '').trim(),
      purchasePrice: Number(this.formGroup.get('purchasePrice')!.value ?? 0),
      salePrice: Number(this.formGroup.get('salePrice')!.value ?? 0),
      status: (this.formGroup.get('status')!.value ??
        VehicleStatus.AVAILABLE) as VehicleStatus,
      photoUrl: this.formGroup.get('photoUrl')!.value ?? undefined,
    };
  }

  onPriceInput(
    field: 'purchasePrice' | 'salePrice',
    rawValue: string | null | undefined,
  ): void {
    const safeValue = rawValue ?? '';
    const { numericValue, displayValue } = normalizeMoneyInput(
      safeValue,
      this.priceDecimals,
    );

    if (field === 'purchasePrice') {
      this.purchasePriceInput = displayValue;
      this.formGroup.get('purchasePrice')?.setValue(numericValue);
      return;
    }

    this.salePriceInput = displayValue;
    this.formGroup.get('salePrice')?.setValue(numericValue);
  }

  onMileageInput(rawValue: string | null | undefined): void {
    const safeValue = rawValue ?? '';
    const { numericValue, displayValue } = normalizeMoneyInput(safeValue, 0);
    this.mileageInput = displayValue;
    this.formGroup.get('mileage')?.setValue(numericValue);
  }

  /**
   * Obtiene el vehículo correcto según el tipo actual y llena el formulario,
   * manejando estados de carga y errores coherentes entre autos y motos.
   * También dispara la carga de imágenes cuando el registro existe.
   *
   * @param id - Identificador del vehículo que se va a editar.
   */
  private loadVehicle(id: number): void {
    this.loadingSignal.set(true);
    if (this.vehicleType === 'CAR') {
      const sub = this.carService
        .getById(id)
        .pipe(finalize(() => this.loadingSignal.set(false)))
        .subscribe({
          next: (vehicle) => {
            this.patchVehicleForm(vehicle);
            this.loadVehicleImages(id);
          },
          error: () => this.handleLoadError(),
        });
      this.subscriptions.push(sub);
      return;
    }

    const sub = this.motorcycleService
      .getById(id)
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (vehicle) => {
          this.patchVehicleForm(vehicle);
          this.loadVehicleImages(id);
        },
        error: () => this.handleLoadError(),
      });
    this.subscriptions.push(sub);
  }

  private patchVehicleForm(vehicle: Car | Motorcycle): void {
    this.formGroup.patchValue({
      ...vehicle,
    });
    this.purchasePriceInput = this.formatPriceInput(vehicle.purchasePrice);
    this.salePriceInput = this.formatPriceInput(vehicle.salePrice);
    this.mileageInput = this.formatMileage(vehicle.mileage);
  }

  private handleLoadError(): void {
    void Swal.fire({
      icon: 'error',
      title: 'No se pudo cargar el vehículo',
      text: 'Verifica el identificador e intenta nuevamente.',
    });
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

  private buildForm(): FormGroup {
    return this.formBuilder.group({
      brand: [
        '',
        [Validators.required, lengthValidator(2, 20), noWhitespaceValidator()],
      ],
      model: [
        '',
        [Validators.required, lengthValidator(1, 20), noWhitespaceValidator()],
      ],
      capacity: [null, [Validators.required, Validators.min(1)]],
      line: [
        '',
        [Validators.required, lengthValidator(1, 20), noWhitespaceValidator()],
      ],
      plate: [
        '',
        [
          Validators.required,
          lengthValidator(5, 10),
          Validators.pattern(/^[A-Z0-9-]+$/i),
        ],
      ],
      motorNumber: [
        '',
        [Validators.required, lengthValidator(5, 30), noWhitespaceValidator()],
      ],
      serialNumber: [
        '',
        [Validators.required, lengthValidator(5, 30), noWhitespaceValidator()],
      ],
      chassisNumber: [
        '',
        [Validators.required, lengthValidator(5, 30), noWhitespaceValidator()],
      ],
      color: [
        '',
        [Validators.required, lengthValidator(3, 20), noWhitespaceValidator()],
      ],
      cityRegistered: [
        '',
        [Validators.required, lengthValidator(3, 30), noWhitespaceValidator()],
      ],
      year: [
        null,
        [Validators.required, Validators.min(1950), Validators.max(2050)],
      ],
      mileage: [null, [Validators.required, Validators.min(0)]],
      transmission: [
        '',
        [Validators.required, lengthValidator(3, 20), noWhitespaceValidator()],
      ],
      purchasePrice: [null, [Validators.required, Validators.min(0)]],
      salePrice: [null, [Validators.min(0)]],
      status: [VehicleStatus.AVAILABLE, Validators.required],
      photoUrl: [''],
      bodyType: [''],
      fuelType: [''],
      numberOfDoors: [4],
      motorcycleType: [''],
    });
  }

  /**
   * Reconfigura las validaciones cuando cambia el tipo de vehículo para evitar
   * reglas inválidas. Se encarga de limpiar valores que no aplican y actualizar
   * el estado de los controles implicados.
   */
  private applyTypeSpecificValidators(): void {
    const bodyType = this.formGroup.get('bodyType')!;
    const fuelType = this.formGroup.get('fuelType')!;
    const numberOfDoors = this.formGroup.get('numberOfDoors')!;
    const motorcycleType = this.formGroup.get('motorcycleType')!;

    if (this.vehicleType === 'CAR') {
      bodyType.setValidators([
        Validators.required,
        lengthValidator(3, 20),
        noWhitespaceValidator(),
      ]);
      fuelType.setValidators([
        Validators.required,
        lengthValidator(3, 20),
        noWhitespaceValidator(),
      ]);
      numberOfDoors.setValidators([
        Validators.required,
        Validators.min(2),
        Validators.max(6),
      ]);
      motorcycleType.clearValidators();
      motorcycleType.reset('');
    } else {
      motorcycleType.setValidators([
        Validators.required,
        lengthValidator(3, 20),
        noWhitespaceValidator(),
      ]);
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
    if (raw === 'motorcycle') {
      return 'MOTORCYCLE';
    }
    return 'CAR';
  }

  private resolveContentType(file: File): string {
    if (file.type === 'image/jpg') {
      return 'image/jpeg';
    }
    return file.type || 'image/jpeg';
  }

  private shouldRetryUpload(error: any): boolean {
    if (error?.status === 0) return true; // preflight abortada o red bloqueada: se trata como fallo transitorio
    const msg = typeof error?.error === 'string' ? error.error : '';
    return (
      msg.includes('SignatureDoesNotMatch') ||
      msg.includes('MissingContentLength') ||
      msg.includes('expired') ||
      msg.includes('Request has expired')
    );
  }

  /**
   * Recupera las imágenes asociadas a un vehículo y las expone vía signal. Se
   * trata como un helper porque la llamada se hace después de cargar los datos
   * base y también tras operaciones como eliminar una imagen.
   *
   * @param vehicleId - Identificador del vehículo cuyas imágenes se consultan.
   */
  private loadVehicleImages(vehicleId: number): void {
    this.vehicleImageService.getImages(vehicleId).subscribe({
      next: (images) => this.vehicleImages.set(images),
      error: () => console.error('No se pudieron cargar las imágenes'),
    });
  }
}
