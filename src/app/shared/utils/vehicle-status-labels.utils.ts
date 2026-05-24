import { VehicleStatus } from '../../features/vehicles/models/vehicle-status.enum';

/**
 * Mapa centralizado de labels en español para los estados de vehículos.
 * Fuente única: evita declarar `Record<VehicleStatus, string>` en cada componente.
 */
const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  [VehicleStatus.AVAILABLE]: 'Disponible',
  [VehicleStatus.SOLD]: 'Vendido',
  [VehicleStatus.IN_MAINTENANCE]: 'En mantenimiento',
  [VehicleStatus.IN_REPAIR]: 'En reparación',
  [VehicleStatus.IN_USE]: 'En uso',
  [VehicleStatus.INACTIVE]: 'Inactivo',
};

/**
 * Retorna el label en español para un estado de vehículo.
 *
 * @param status - Estado del vehículo a resolver.
 * @returns Texto legible en español, o el valor del enum si no hay mapeo.
 */
export function getVehicleStatusLabel(status: VehicleStatus): string {
  return VEHICLE_STATUS_LABELS[status] ?? status;
}

/**
 * Retorna la clase CSS de Bootstrap para el badge de un estado de vehículo.
 *
 * @param status - Estado del vehículo.
 * @returns Clase(s) CSS de Bootstrap (e.g., `'bg-success'`, `'bg-warning text-dark'`).
 */
export function getVehicleStatusBadgeClass(status: VehicleStatus): string {
  switch (status) {
    case VehicleStatus.AVAILABLE:
      return 'bg-success';
    case VehicleStatus.SOLD:
      return 'bg-secondary';
    case VehicleStatus.IN_MAINTENANCE:
      return 'bg-warning text-dark';
    case VehicleStatus.IN_REPAIR:
      return 'bg-danger';
    case VehicleStatus.IN_USE:
      return 'bg-info text-dark';
    case VehicleStatus.INACTIVE:
    default:
      return 'bg-dark';
  }
}
