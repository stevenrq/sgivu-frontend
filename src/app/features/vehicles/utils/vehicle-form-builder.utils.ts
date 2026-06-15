import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { VehicleStatus } from '../models/vehicle-status.enum';
import {
  lengthValidator,
  textFieldValidators,
} from '../../../shared/validators/form.validator';

export type VehicleFormType = 'CAR' | 'MOTORCYCLE';

export interface VehicleFormControls {
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

export function buildVehicleForm(
  fb: FormBuilder,
): FormGroup<VehicleFormControls> {
  return fb.group<VehicleFormControls>({
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

export function applyVehicleTypeValidators(
  formGroup: FormGroup<VehicleFormControls>,
  type: VehicleFormType,
): void {
  const { bodyType, fuelType, numberOfDoors, motorcycleType } =
    formGroup.controls;

  if (type === 'CAR') {
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
