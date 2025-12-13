import { Injectable } from '@angular/core';
import { UserService } from '../../features/users/services/user.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
/** Utilidades de UI para confirmar y ejecutar acciones sobre usuarios. */
export class UserUiHelperService {
  constructor(private readonly userService: UserService) {}

  /**
   * Centraliza la confirmación SweetAlert y la llamada a `UserService.updateStatus`.
   * El callback `onSuccess` permite reutilizar la misma rutina en listas o
   * vistas de detalle para refrescar la UI tras un éxito.
   *
   * @param id - Identificador del usuario a actualizar.
   * @param status - Estado destino (`true` = activo, `false` = inactivo).
   * @param onSuccess - Acción que se ejecuta tras un éxito (p.ej. recargar la lista).
   *
   * @example
   * const currentPage = this.pager?.number ?? 0;
   * this.userUiHelper.updateStatus(id, status, () => this.loadUsers(currentPage));
   */
  updateStatus(id: number, status: boolean, onSuccess: () => void): void {
    Swal.fire({
      title: '¿Estás seguro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    }).then((result) => {
      if (result.isConfirmed) {
        this.userService.updateStatus(id, status).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Estado actualizado exitosamente',
              confirmButtonColor: '#3085d6',
            });
            onSuccess();
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo actualizar el estado del usuario. Intenta nuevamente.',
              confirmButtonColor: '#d33',
            });
          },
        });
      }
    });
  }

  /**
   * Centraliza la confirmación SweetAlert y la llamada a `UserService.delete`.
   * El callback `onSuccess` permite decidir cómo refrescar la navegación tras
   * una eliminación exitosa.
   *
   * @param id - Identificador del usuario a eliminar.
   * @param onSuccess - Acción tras un éxito (p.ej. recargar la lista o redirigir).
   *
   * @example
   * const currentPage = this.pager?.number ?? 0;
   * this.userUiHelper.delete(id, () => this.loadUsers(currentPage));
   */
  delete(id: number, onSuccess: () => void): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede revertir.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.userService.delete(id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Usuario eliminado',
              text: 'El usuario fue eliminado exitosamente.',
              confirmButtonColor: '#3085d6',
            });
            onSuccess();
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo eliminar el usuario. Intenta nuevamente.',
              confirmButtonColor: '#d33',
            });
          },
        });
      }
    });
  }
}
