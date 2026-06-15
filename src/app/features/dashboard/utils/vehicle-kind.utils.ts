import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';
import { DemandPredictionRequest } from '../../../shared/models/demand-prediction.model';

export function normalizeVehicleType(
  value?: string | VehicleKind | null,
): VehicleKind | null {
  if (!value) {
    return null;
  }
  const normalized = value.toString().toUpperCase();
  if (normalized === VehicleKind.MOTORCYCLE) {
    return VehicleKind.MOTORCYCLE;
  }
  if (normalized === VehicleKind.CAR) {
    return VehicleKind.CAR;
  }
  return null;
}

export function describeSegment(payload: DemandPredictionRequest): string {
  const typeLabel =
    payload.vehicleType === VehicleKind.MOTORCYCLE
      ? 'Motocicleta'
      : 'Automóvil';
  const base = `${typeLabel} · ${payload.brand} ${payload.model}`;
  if (payload.line) {
    return `${base} (${payload.line})`;
  }
  return base;
}
