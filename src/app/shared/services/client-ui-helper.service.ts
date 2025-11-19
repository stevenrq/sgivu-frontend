import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';
import { PersonService } from '../../features/clients/services/person.service';
import { CompanyService } from '../../features/clients/services/company.service';

interface ClientStatusUpdateConfig {
  entityDescription: string;
  nextStatus: boolean;
  request$: Observable<unknown>;
  onSuccess: () => void;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Consolida los flujos de activación/desactivación de clientes (personas o empresas)
 * mostrando confirmaciones consistentes y delegando la llamada al servicio correcto.
 */
export class ClientUiHelperService {
  constructor(
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
  ) {}

  /**
   * Cambia el estado de un cliente persona ejecutando los pasos comunes de confirmación
   * y manejo de respuesta.
   *
   * @param id Identificador de la persona.
   * @param nextStatus Estado objetivo (`true` activo, `false` inactivo).
   * @param onSuccess Callback que se ejecuta tras una actualización exitosa.
   * @param personName Nombre a mostrar en los mensajes (opcional).
   */
  updatePersonStatus(
    id: number,
    nextStatus: boolean,
    onSuccess: () => void,
    personName?: string,
  ): void {
    const description = personName
      ? `el cliente ${personName}`
      : 'el cliente persona';
    this.confirmAndExecute({
      entityDescription: description,
      nextStatus,
      request$: this.personService.updateStatus(id, nextStatus),
      onSuccess,
    });
  }

  /**
   * Variante para empresas; utiliza el servicio especializado y ajusta los textos
   * según el tipo de cliente.
   *
   * @param id Identificador de la empresa.
   * @param nextStatus Estado a aplicar.
   * @param onSuccess Acción a ejecutar post-actualización.
   * @param companyName Nombre comercial utilizado en el mensaje (opcional).
   */
  updateCompanyStatus(
    id: number,
    nextStatus: boolean,
    onSuccess: () => void,
    companyName?: string,
  ): void {
    const description = companyName
      ? `la empresa ${companyName}`
      : 'la empresa';
    this.confirmAndExecute({
      entityDescription: description,
      nextStatus,
      request$: this.companyService.updateStatus(id, nextStatus),
      onSuccess,
    });
  }

  /**
   * Encapsula el diálogo de confirmación y la suscripción a la petición remota.
   * En caso de éxito ejecuta el callback provisto.
   *
   * @param config Configuración de la operación (descripción, estado y observable).
   */
  private confirmAndExecute(config: ClientStatusUpdateConfig): void {
    const action = config.nextStatus ? 'activar' : 'desactivar';

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
            title: 'Estado actualizado exitosamente',
            confirmButtonColor: '#3085d6',
          });
          config.onSuccess();
        },
        error: () => {
          void Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el estado del cliente. Intenta nuevamente.',
            confirmButtonColor: '#d33',
          });
        },
      });
    });
  }
}
