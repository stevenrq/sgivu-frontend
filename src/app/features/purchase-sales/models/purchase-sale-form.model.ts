import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ContractStatus } from './contract-status.enum';
import { ContractType } from './contract-type.enum';
import { PaymentMethod } from './payment-method.enum';
import { VehicleKind } from './vehicle-kind.enum';
import { VehicleCreationPayload } from './purchase-sale.model';
import {
  lengthValidator,
  textFieldValidators,
} from '../../../shared/validators/form.validator';

// --- Formulario de Contrato ---

/**
 * Controles tipados del formulario reactivo de contrato.
 * Cada propiedad corresponde a un `FormControl` con su tipo de dato.
 */
export interface ContractFormControls {
  clientId: FormControl<number | null>;
  userId: FormControl<number | null>;
  vehicleId: FormControl<number | null>;
  contractType: FormControl<ContractType>;
  contractStatus: FormControl<ContractStatus | null>;
  purchasePrice: FormControl<number | null>;
  salePrice: FormControl<number | null>;
  paymentLimitations: FormControl<string>;
  paymentTerms: FormControl<string>;
  paymentMethod: FormControl<PaymentMethod | null>;
  observations: FormControl<string>;
}

/**
 * Construye un `FormGroup<ContractFormControls>` con valores por defecto y validadores.
 *
 * @param fb - FormBuilder inyectado.
 * @param contractType - Tipo de contrato inicial (compra por defecto).
 * @returns FormGroup tipado listo para usar.
 */
export function buildContractFormGroup(
  fb: FormBuilder,
  contractType: ContractType = ContractType.PURCHASE,
): FormGroup<ContractFormControls> {
  const group = fb.group<ContractFormControls>({
    clientId: new FormControl<number | null>(null, Validators.required),
    userId: new FormControl<number | null>(null, Validators.required),
    vehicleId: new FormControl<number | null>(null),
    contractType: new FormControl<ContractType>(contractType, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    contractStatus: new FormControl<ContractStatus | null>(
      ContractStatus.PENDING,
      Validators.required,
    ),
    purchasePrice: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    salePrice: new FormControl<number | null>(null),
    paymentLimitations: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, lengthValidator(1, 200)],
    }),
    paymentTerms: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, lengthValidator(1, 200)],
    }),
    paymentMethod: new FormControl<PaymentMethod | null>(
      null,
      Validators.required,
    ),
    observations: new FormControl<string>('', { nonNullable: true }),
  });

  applyContractTypeValidators(group, contractType);
  return group;
}

/**
 * Aplica validadores dinámicos según el tipo de contrato.
 * - SALE: `vehicleId` y `salePrice` son requeridos.
 * - PURCHASE: `vehicleId` y `salePrice` son opcionales.
 */
export function applyContractTypeValidators(
  group: FormGroup<ContractFormControls>,
  contractType: ContractType,
): void {
  const { vehicleId, salePrice } = group.controls;

  if (contractType === ContractType.SALE) {
    vehicleId.setValidators(Validators.required);
    salePrice.setValidators([Validators.required, Validators.min(1)]);
  } else {
    vehicleId.clearValidators();
    salePrice.clearValidators();
  }

  vehicleId.updateValueAndValidity({ emitEvent: false });
  salePrice.updateValueAndValidity({ emitEvent: false });
}

// --- Formulario de Vehículo ---

/**
 * Controles tipados del formulario reactivo de vehículo dentro de un contrato de compra.
 * Incluye campos de carro y moto; `applyVehicleTypeValidators()` configura
 * los validadores según el tipo seleccionado.
 */
export interface VehicleFormControls {
  vehicleType: FormControl<VehicleKind>;
  brand: FormControl<string>;
  model: FormControl<string>;
  capacity: FormControl<number | null>;
  line: FormControl<string>;
  plate: FormControl<string>;
  motorNumber: FormControl<string>;
  serialNumber: FormControl<string>;
  chassisNumber: FormControl<string>;
  color: FormControl<string>;
  cityRegistered: FormControl<string>;
  year: FormControl<number | null>;
  mileage: FormControl<number | null>;
  transmission: FormControl<string>;
  salePrice: FormControl<number | null>;
  photoUrl: FormControl<string>;
  // Solo para carros
  bodyType: FormControl<string>;
  fuelType: FormControl<string>;
  numberOfDoors: FormControl<number | null>;
  // Solo para motos
  motorcycleType: FormControl<string>;
}

/**
 * Construye un `FormGroup<VehicleFormControls>` con valores por defecto y validadores.
 *
 * @param fb - FormBuilder inyectado.
 * @param vehicleType - Tipo de vehículo inicial (automóvil por defecto).
 * @returns FormGroup tipado listo para usar.
 */
export function buildVehicleFormGroup(
  fb: FormBuilder,
  vehicleType: VehicleKind = VehicleKind.CAR,
): FormGroup<VehicleFormControls> {
  const group = fb.group<VehicleFormControls>({
    vehicleType: new FormControl<VehicleKind>(vehicleType, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    brand: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 20),
    }),
    model: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 20),
    }),
    capacity: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    line: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 20),
    }),
    plate: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, lengthValidator(1, 10)],
    }),
    motorNumber: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 30),
    }),
    serialNumber: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 30),
    }),
    chassisNumber: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 30),
    }),
    color: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 20),
    }),
    cityRegistered: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 30),
    }),
    year: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1950),
      Validators.max(2050),
    ]),
    mileage: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    transmission: new FormControl<string>('', {
      nonNullable: true,
      validators: textFieldValidators(1, 20),
    }),
    salePrice: new FormControl<number | null>(null),
    photoUrl: new FormControl<string>('', { nonNullable: true }),
    bodyType: new FormControl<string>('', { nonNullable: true }),
    fuelType: new FormControl<string>('', { nonNullable: true }),
    numberOfDoors: new FormControl<number | null>(null),
    motorcycleType: new FormControl<string>('', { nonNullable: true }),
  });

  applyVehicleTypeValidators(group, vehicleType);
  return group;
}

/**
 * Aplica validadores dinámicos según el tipo de vehículo.
 * - CAR: bodyType, fuelType, numberOfDoors son requeridos; motorcycleType se limpia.
 * - MOTORCYCLE: motorcycleType es requerido; bodyType, fuelType, numberOfDoors se limpian.
 */
export function applyVehicleTypeValidators(
  group: FormGroup<VehicleFormControls>,
  vehicleType: VehicleKind,
): void {
  const { bodyType, fuelType, numberOfDoors, motorcycleType } = group.controls;

  if (vehicleType === VehicleKind.CAR) {
    bodyType.setValidators(textFieldValidators(1, 20));
    fuelType.setValidators(textFieldValidators(1, 20));
    numberOfDoors.setValidators([
      Validators.required,
      Validators.min(2),
      Validators.max(6),
    ]);
    motorcycleType.clearValidators();
    motorcycleType.reset('', { emitEvent: false });
  } else {
    motorcycleType.setValidators(textFieldValidators(1, 20));
    bodyType.clearValidators();
    fuelType.clearValidators();
    numberOfDoors.clearValidators();
    bodyType.reset('', { emitEvent: false });
    fuelType.reset('', { emitEvent: false });
    numberOfDoors.reset(null, { emitEvent: false });
  }

  bodyType.updateValueAndValidity({ emitEvent: false });
  fuelType.updateValueAndValidity({ emitEvent: false });
  numberOfDoors.updateValueAndValidity({ emitEvent: false });
  motorcycleType.updateValueAndValidity({ emitEvent: false });
}

// --- Construcción del Payload ---

/**
 * Transforma el FormGroup de vehículo al payload de API, sanitizando valores y
 * filtrando campos exclusivos de carro o moto según `vehicleType`.
 *
 * @param formGroup - FormGroup tipado del vehículo.
 * @returns Payload formateado para enviar al backend.
 */
export function buildVehiclePayload(
  formGroup: FormGroup<VehicleFormControls>,
): VehicleCreationPayload {
  const form = formGroup.getRawValue();
  const trim = (value: string | null | undefined): string =>
    value?.trim() ?? '';
  const isCar = form.vehicleType === VehicleKind.CAR;
  const isMoto = form.vehicleType === VehicleKind.MOTORCYCLE;

  const salePrice =
    form.salePrice !== null && form.salePrice !== undefined
      ? Number(form.salePrice)
      : undefined;
  const numberOfDoors =
    isCar && form.numberOfDoors !== null
      ? Number(form.numberOfDoors)
      : undefined;

  return {
    vehicleType: form.vehicleType,
    brand: trim(form.brand),
    model: trim(form.model),
    capacity: Number(form.capacity ?? 0),
    line: trim(form.line),
    plate: trim(form.plate).toUpperCase(),
    motorNumber: trim(form.motorNumber),
    serialNumber: trim(form.serialNumber),
    chassisNumber: trim(form.chassisNumber),
    color: trim(form.color),
    cityRegistered: trim(form.cityRegistered),
    year: Number(form.year ?? 0),
    mileage: Number(form.mileage ?? 0),
    transmission: trim(form.transmission),
    salePrice,
    photoUrl: trim(form.photoUrl) || undefined,
    bodyType: isCar ? trim(form.bodyType) : undefined,
    fuelType: isCar ? trim(form.fuelType) : undefined,
    numberOfDoors,
    motorcycleType: isMoto ? trim(form.motorcycleType) : undefined,
  };
}
