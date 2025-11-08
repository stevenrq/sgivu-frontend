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
export class ClientUiHelperService {
  constructor(
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
  ) {}

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
