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
export class VehicleUiHelperService {
  constructor(
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
  ) {}

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
