import { Injectable } from '@angular/core';
import { UserService } from '../../features/users/services/user.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class UserUiHelperService {
  constructor(private readonly userService: UserService) {}

  /**
   * Muestra un diálogo de confirmación para actualizar el estado de un usuario
   * (activo/inactivo), realiza la petición al backend y gestiona la respuesta.
   *
   * Este método centraliza toda la lógica repetida de confirmación con SweetAlert2,
   * la llamada al `UserService` y el manejo de errores.
   * La acción a ejecutar tras un éxito es definida mediante un callback (`onSuccess`),
   * lo que permite reutilizar el método en distintos componentes (ej. listas, detalles).
   *
   * @param id - Identificador único del usuario cuyo estado será actualizado.
   * @param status - Nuevo estado que se asignará al usuario (`true` = activo, `false` = inactivo).
   * @param onSuccess - Función de callback que se ejecuta tras una actualización exitosa
   *                    (por ejemplo, recargar la lista de usuarios o refrescar un perfil).
   *
   * @example
   * // En componente de lista:
   * const currentPage = this.pager?.number ?? 0;
   * this.userUiHelper.updateStatus(id, status, () => this.loadUsers(currentPage));
   *
   * @example
   * // En componente de detalle:
   * this.userUiHelper.updateStatus(id, status, () => this.loadUser(this.user!.id));
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
   * Muestra un diálogo de confirmación para eliminar un usuario, realiza la petición
   * al backend y gestiona la respuesta.
   *
   * Este método centraliza toda la lógica repetida de confirmación con SweetAlert2,
   * la llamada al `UserService` y el manejo de errores.
   * La acción a ejecutar tras un éxito es definida mediante un callback (`onSuccess`),
   * lo que permite reutilizar el método en distintos componentes (ej. listas, detalles).
   *
   * @param id - Identificador único del usuario que será eliminado.
   * @param onSuccess - Función de callback que se ejecuta tras una eliminación exitosa
   *                    (por ejemplo, recargar la lista de usuarios o redirigir a otra vista).
   *
   * @example
   * // En componente de lista:
   * const currentPage = this.pager?.number ?? 0;
   * this.userUiHelper.delete(id, () => this.loadUsers(currentPage));
   *
   * @example
   * // En componente de detalle:
   * this.userUiHelper.delete(this.user!.id, () => this.router.navigate(['/users']));
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
