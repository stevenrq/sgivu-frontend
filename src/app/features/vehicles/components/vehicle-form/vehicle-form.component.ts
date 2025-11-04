import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { finalize, Observable, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import {
  noWhitespaceValidator,
  lengthValidator,
} from '../../../../shared/validators/form.validator';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { CarService } from '../../services/car.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';

type VehicleFormType = 'CAR' | 'MOTORCYCLE';

type CarPayload = Omit<Car, 'id'> & Partial<Pick<Car, 'id'>>;
type MotorcyclePayload = Omit<Motorcycle, 'id'> & Partial<Pick<Motorcycle, 'id'>>;

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.css',
})
export class VehicleFormComponent implements OnInit, OnDestroy {
  formGroup: FormGroup;
  isEditMode = false;
  readonly statuses = Object.values(VehicleStatus);

  private vehicleId: number | null = null;
  private vehicleType: VehicleFormType = 'CAR';
  private readonly subscriptions: Subscription[] = [];

  private readonly loadingSignal = signal<boolean>(false);
  readonly isLoading = computed(() => this.loadingSignal());

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.formGroup = this.buildForm();
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
          const redirect = this.isCar
            ? ['/vehicles/cars/page', 0]
            : ['/vehicles/motorcycles/page', 0];
          void this.router.navigate(redirect);
        },
        error: (error) => {
          if (error?.status === 409) {
            void Swal.fire({
              icon: 'warning',
              title: 'Datos duplicados',
              text:
                'Ya existe un vehículo con la placa, número de motor, serial o chasis ingresado. Verifica que esos campos sean únicos.',
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
      cityRegistered: (this.formGroup.get('cityRegistered')!.value ?? '').trim(),
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

  private loadVehicle(id: number): void {
    this.loadingSignal.set(true);
    if (this.vehicleType === 'CAR') {
      const sub = this.carService
        .getById(id)
        .pipe(finalize(() => this.loadingSignal.set(false)))
        .subscribe({
          next: (vehicle) => this.patchVehicleForm(vehicle),
          error: () => this.handleLoadError(),
        });
      this.subscriptions.push(sub);
      return;
    }

    const sub = this.motorcycleService
      .getById(id)
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (vehicle) => this.patchVehicleForm(vehicle),
        error: () => this.handleLoadError(),
      });
    this.subscriptions.push(sub);
  }

  private patchVehicleForm(vehicle: Car | Motorcycle): void {
    this.formGroup.patchValue({
      ...vehicle,
    });
  }

  private handleLoadError(): void {
    void Swal.fire({
      icon: 'error',
      title: 'No se pudo cargar el vehículo',
      text: 'Verifica el identificador e intenta nuevamente.',
    });
    void this.router.navigate(['/vehicles']);
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
      salePrice: [null, [Validators.required, Validators.min(0)]],
      status: [VehicleStatus.AVAILABLE, Validators.required],
      photoUrl: [''],
      bodyType: [''],
      fuelType: [''],
      numberOfDoors: [4],
      motorcycleType: [''],
    });
  }

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
}
