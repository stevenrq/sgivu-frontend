import { Injectable, inject } from '@angular/core';
import { UserService } from '../../features/users/services/user.service';
import { ConfirmActionService } from './confirm-action.service';

/**
 * Servicio auxiliar de UI para operaciones de usuarios.
 * Centraliza los diálogos de confirmación para cambiar el estado
 * y eliminar usuarios, delegando la ejecución a `ConfirmActionService`.
 */
@Injectable({
  providedIn: 'root',
})
export class UserUiHelperService {
  private readonly userService = inject(UserService);
  private readonly confirmAction = inject(ConfirmActionService);

  /**
   * Muestra un diálogo de confirmación y actualiza el estado de un usuario.
   *
   * @param id - Identificador del usuario.
   * @param status - Nuevo estado deseado (`true` = activo, `false` = inactivo).
   * @param onSuccess - Callback invocado tras la actualización exitosa.
   */
  updateStatus(id: number, status: boolean, onSuccess: () => void): void {
    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      action$: this.userService.updateStatus(id, status),
      successTitle: 'Estado actualizado exitosamente',
      errorText:
        'No se pudo actualizar el estado del usuario. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }

  /**
   * Muestra un diálogo de confirmación irreversible y elimina un usuario.
   *
   * @param id - Identificador del usuario a eliminar.
   * @param onSuccess - Callback invocado tras la eliminación exitosa.
   */
  delete(id: number, onSuccess: () => void): void {
    this.confirmAction.confirmAndExecute({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede revertir.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      action$: this.userService.delete(id),
      successTitle: 'Usuario eliminado',
      errorText: 'No se pudo eliminar el usuario. Intenta nuevamente.',
      onSuccess: () => onSuccess(),
    });
  }
}
