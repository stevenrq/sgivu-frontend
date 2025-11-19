import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';
import { VehicleStatus } from '../../features/vehicles/models/vehicle-status.enum';
import { CarService } from '../../features/vehicles/services/car.service';
import { MotorcycleService } from '../../features/vehicles/services/motorcycle.service';

interface VehicleStatusUpdateConfig {
  entityDescription: string;
  nextStatus: VehicleStatus;
  request$: Observable<unknown>;
  onSuccess: () => void;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Centraliza la lógica de confirmación y actualización de estado para vehículos.
 * Evita duplicar prompts de SweetAlert2 y llamadas a los servicios de autos/motos
 * en todos los componentes que administran inventario.
 */
export class VehicleUiHelperService {
  constructor(
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
  ) {}

  /**
   * Confirma y ejecuta el cambio de estado para un automóvil llamando al servicio
   * correspondiente. Permite mostrar la placa en el mensaje para mayor claridad.
   *
   * @param id Identificador del automóvil.
   * @param nextStatus Estado objetivo.
   * @param onSuccess Callback a ejecutar al finalizar correctamente.
   * @param plate Texto opcional que describe la placa en la alerta.
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
    this.confirmStatusChange({
      entityDescription: description,
      nextStatus,
      request$: this.carService.changeStatus(id, nextStatus),
      onSuccess,
    });
  }

  /**
   * Variante para motocicletas; reutiliza el mismo flujo pero ajusta la descripción
   * mostrada en los mensajes.
   *
   * @param id Identificador de la motocicleta.
   * @param nextStatus Estado objetivo a asignar.
   * @param onSuccess Acción a ejecutar tras el éxito.
   * @param plate Placa usada en el texto de confirmación.
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
    this.confirmStatusChange({
      entityDescription: description,
      nextStatus,
      request$: this.motorcycleService.changeStatus(id, nextStatus),
      onSuccess,
    });
  }

  /**
   * Despliega el diálogo de confirmación y, al aceptarse, ejecuta la petición remota.
   * Centraliza el manejo de errores y la notificación de éxito.
   *
   * @param config Configuración de la actualización (texto, estado, observable y callback).
   */
  private confirmStatusChange(config: VehicleStatusUpdateConfig): void {
    const action = this.describeAction(config.nextStatus);

    void Swal.fire({
      title: '¿Estás seguro?',
      text: `Se ${action}á ${config.entityDescription}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      config.request$.subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Estado actualizado con éxito',
            confirmButtonColor: '#3085d6',
          });
          config.onSuccess();
        },
        error: () => {
          void Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el estado del vehículo. Intenta nuevamente.',
            confirmButtonColor: '#d33',
          });
        },
      });
    });
  }

  /**
   * Traduce el estado destino en un verbo para usarlo en el mensaje.
   *
   * @param status Estado que se aplicará.
   * @returns Verbo amigable (activar/desactivar/actualizar).
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
