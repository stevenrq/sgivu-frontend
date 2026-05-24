import { Injectable, inject } from '@angular/core';
import { PersonService } from '../../features/clients/services/person.service';
import { CompanyService } from '../../features/clients/services/company.service';
import { ConfirmActionService } from './confirm-action.service';

/**
 * Servicio auxiliar de UI para operaciones de estado de clientes (personas y empresas).
 * Centraliza los diálogos de confirmación y los mensajes de éxito/error,
 * delegando la ejecución a `ConfirmActionService`.
 */
@Injectable({
  providedIn: 'root',
})
export class ClientUiHelperService {
  private readonly personService = inject(PersonService);
  private readonly companyService = inject(CompanyService);
  private readonly confirmAction = inject(ConfirmActionService);

  /**
   * Muestra un diálogo de confirmación y actualiza el estado de una persona cliente.
   *
   * @param id - Identificador de la persona.
   * @param nextStatus - Nuevo estado deseado (`true` = activo, `false` = inactivo).
   * @param onSuccess - Callback invocado tras la actualización exitosa.
   * @param personName - Nombre de la persona para personalizar el mensaje (opcional).
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
    const action = nextStatus ? 'activar' : 'desactivar';

    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      text: `Se ${action}á ${description}.`,
      action$: this.personService.updateStatus(id, nextStatus),
      successTitle: 'Estado actualizado exitosamente',
      errorText:
        'No se pudo actualizar el estado del cliente. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }

  /**
   * Muestra un diálogo de confirmación y actualiza el estado de una empresa cliente.
   *
   * @param id - Identificador de la empresa.
   * @param nextStatus - Nuevo estado deseado (`true` = activo, `false` = inactivo).
   * @param onSuccess - Callback invocado tras la actualización exitosa.
   * @param companyName - Nombre de la empresa para personalizar el mensaje (opcional).
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
    const action = nextStatus ? 'activar' : 'desactivar';

    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      text: `Se ${action}á ${description}.`,
      action$: this.companyService.updateStatus(id, nextStatus),
      successTitle: 'Estado actualizado exitosamente',
      errorText:
        'No se pudo actualizar el estado del cliente. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }
}
