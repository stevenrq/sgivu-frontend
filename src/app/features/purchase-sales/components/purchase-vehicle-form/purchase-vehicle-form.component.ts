import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { startWith, switchMap } from 'rxjs';
import { showControlErrors } from '../../../../shared/utils/form.utils';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { VehicleKind } from '../../models/vehicle-kind.enum';
import {
  VehicleFormControls,
  applyVehicleTypeValidators,
  buildVehiclePayload,
} from '../../models/purchase-sale-form.model';
import { VehicleCreationPayload } from '../../models/purchase-sale.model';
import {
  formatCopCurrency,
  normalizeMoneyInput,
  parseCopCurrency,
} from '../../../../shared/utils/currency.utils';

/**
 * Sub-formulario de datos del vehículo dentro del proceso de registro de contrato de compra.
 * Recibe el `FormGroup` del vehículo como `input.required` y gestiona los campos
 * dinámicos según el tipo seleccionado (`CAR` | `MOTORCYCLE`).
 * Expone `buildPayload()` para que el componente padre construya el payload final.
 */
@Component({
  selector: 'app-purchase-vehicle-form',
  imports: [ReactiveFormsModule],
  templateUrl: './purchase-vehicle-form.component.html',
  styleUrl: './purchase-vehicle-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseVehicleFormComponent {
  readonly vehicleFormGroup = input.required<FormGroup<VehicleFormControls>>();
  readonly submitted = input(false);
  readonly vehicleKinds = Object.values(VehicleKind);
  protected readonly showControlErrors = showControlErrors;

  readonly vehicleSalePriceInput = signal('');
  readonly vehicleMileageInput = signal('');

  private readonly mileageFormatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Tipo de vehículo reactivo: se re-suscribe al `valueChanges` del control cada
  // vez que el padre reconstruye el FormGroup (input). Reactivo bajo zoneless
  // tanto si el tipo cambia por evento del usuario como desde un callback async.
  private readonly vehicleType = toSignal(
    toObservable(this.vehicleFormGroup).pipe(
      switchMap((group) =>
        group.controls.vehicleType.valueChanges.pipe(
          startWith(group.controls.vehicleType.value),
        ),
      ),
    ),
    { initialValue: VehicleKind.CAR },
  );

  readonly isCarSelected = computed(
    () => this.vehicleType() === VehicleKind.CAR,
  );

  readonly isMotorcycleSelected = computed(
    () => this.vehicleType() === VehicleKind.MOTORCYCLE,
  );

  /** Actualiza los validadores del formulario al cambiar el tipo de vehículo y limpia el precio. */
  onVehicleTypeChange(): void {
    const kind = this.vehicleFormGroup().controls.vehicleType.value;
    applyVehicleTypeValidators(this.vehicleFormGroup(), kind);
    this.vehicleSalePriceInput.set('');
  }

  onPriceInput(value: string): void {
    const { numericValue, displayValue } = normalizeMoneyInput(value, 0);
    this.vehicleSalePriceInput.set(displayValue);
    this.vehicleFormGroup().controls.salePrice.setValue(numericValue);
  }

  onMileageInput(value: string): void {
    const numericValue = parseCopCurrency(value);
    if (numericValue === null) {
      this.vehicleFormGroup().controls.mileage.setValue(null);
      this.vehicleMileageInput.set('');
      return;
    }
    const sanitized = Math.max(0, Math.floor(numericValue));
    this.vehicleFormGroup().controls.mileage.setValue(sanitized);
    this.vehicleMileageInput.set(this.formatMileage(sanitized));
  }

  formatCurrency(value: number | null | undefined): string {
    return formatCopCurrency(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  formatMileage(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return this.mileageFormatter.format(value);
  }

  buildPayload(): VehicleCreationPayload {
    return buildVehiclePayload(this.vehicleFormGroup());
  }

  resetDisplayInputs(): void {
    this.vehicleSalePriceInput.set('');
    this.vehicleMileageInput.set('');
  }
}
