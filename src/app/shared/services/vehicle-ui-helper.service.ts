import { Injectable, inject } from '@angular/core';
import { VehicleStatus } from '../../features/vehicles/models/vehicle-status.enum';
import { CarService } from '../../features/vehicles/services/car.service';
import { MotorcycleService } from '../../features/vehicles/services/motorcycle.service';
import { ConfirmActionService } from './confirm-action.service';

/**
 * Servicio auxiliar de UI para operaciones de estado de vehículos (autos y motos).
 * Centraliza los diálogos de confirmación antes de actualizar el estado,
 * delegando la ejecución a `ConfirmActionService`.
 */
@Injectable({
  providedIn: 'root',
})
export class VehicleUiHelperService {
  private readonly carService = inject(CarService);
  private readonly motorcycleService = inject(MotorcycleService);
  private readonly confirmAction = inject(ConfirmActionService);

  /**
   * Muestra un diálogo de confirmación y actualiza el estado de un automóvil.
   *
   * @param id - Identificador del automóvil.
   * @param nextStatus - Nuevo estado del vehículo.
   * @param onSuccess - Callback invocado tras la actualización exitosa.
   * @param plate - Placa del vehículo para personalizar el mensaje (opcional).
   */
  updateCarStatus(
    id: number,
    nextStatus: VehicleStatus,
    onSuccess: () => void,
    plate?: string,
  ): void {
    const description = plate
      ? `el automóvil con placa ${plate}`
      : 'el automóvil seleccionado';

    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      text: `Se ${this.describeAction(nextStatus)}á ${description}.`,
      action$: this.carService.changeStatus(id, nextStatus),
      successTitle: 'Estado actualizado con éxito',
      errorText:
        'No se pudo actualizar el estado del vehículo. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }

  /**
   * Muestra un diálogo de confirmación y actualiza el estado de una motocicleta.
   *
   * @param id - Identificador de la motocicleta.
   * @param nextStatus - Nuevo estado del vehículo.
   * @param onSuccess - Callback invocado tras la actualización exitosa.
   * @param plate - Placa del vehículo para personalizar el mensaje (opcional).
   */
  updateMotorcycleStatus(
    id: number,
    nextStatus: VehicleStatus,
    onSuccess: () => void,
    plate?: string,
  ): void {
    const description = plate
      ? `la motocicleta con placa ${plate}`
      : 'la motocicleta seleccionada';

    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      text: `Se ${this.describeAction(nextStatus)}á ${description}.`,
      action$: this.motorcycleService.changeStatus(id, nextStatus),
      successTitle: 'Estado actualizado con éxito',
      errorText:
        'No se pudo actualizar el estado del vehículo. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }

  /**
   * Retorna el verbo de acción en español para el estado destino,
   * usado para construir el texto del diálogo de confirmación.
   *
   * @param status - Estado destino del vehículo.
   * @returns Verbo en infinitivo: `'desactivar'`, `'activar'` o `'actualizar'`.
   */
  private describeAction(status: VehicleStatus): string {
    if (status === VehicleStatus.INACTIVE) {
      return 'desactivar';
    }
    if (status === VehicleStatus.AVAILABLE) {
      return 'activar';
    }
    return 'actualizar';
  }
}
