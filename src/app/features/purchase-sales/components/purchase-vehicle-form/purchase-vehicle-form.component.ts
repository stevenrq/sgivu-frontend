import { Component, input, ChangeDetectionStrategy } from '@angular/core';
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

  vehicleSalePriceInput = '';
  vehicleMileageInput = '';

  private readonly mileageFormatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  get isCarSelected(): boolean {
    return (
      this.vehicleFormGroup().controls.vehicleType.value === VehicleKind.CAR
    );
  }

  get isMotorcycleSelected(): boolean {
    return (
      this.vehicleFormGroup().controls.vehicleType.value ===
      VehicleKind.MOTORCYCLE
    );
  }

  /** Actualiza los validadores del formulario al cambiar el tipo de vehículo y limpia el precio. */
  onVehicleTypeChange(): void {
    const kind = this.vehicleFormGroup().controls.vehicleType.value;
    applyVehicleTypeValidators(this.vehicleFormGroup(), kind);
    this.vehicleSalePriceInput = '';
  }

  onPriceInput(value: string): void {
    const { numericValue, displayValue } = normalizeMoneyInput(value, 0);
    this.vehicleSalePriceInput = displayValue;
    this.vehicleFormGroup().controls.salePrice.setValue(numericValue);
  }

  onMileageInput(value: string): void {
    const numericValue = parseCopCurrency(value);
    if (numericValue === null) {
      this.vehicleFormGroup().controls.mileage.setValue(null);
      this.vehicleMileageInput = '';
      return;
    }
    const sanitized = Math.max(0, Math.floor(numericValue));
    this.vehicleFormGroup().controls.mileage.setValue(sanitized);
    this.vehicleMileageInput = this.formatMileage(sanitized);
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
    this.vehicleSalePriceInput = '';
    this.vehicleMileageInput = '';
  }
}
