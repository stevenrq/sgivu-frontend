import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/role.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/roles`;

  /**
   * Agrega permisos a un rol existente (union — no reemplaza los existentes).
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Lista de nombres de permisos a agregar.
   * @returns Observable con el rol actualizado.
   */
  public addPermissions(roleId: number, permissions: string[]) {
    return this.http.post<Role>(
      `${this.apiUrl}/${roleId}/add-permissions`,
      permissions,
    );
  }

  /**
   * Obtiene todos los roles del sistema.
   *
   * @returns Observable con el `Set` de roles.
   */
  public findAll() {
    return this.http.get<Set<Role>>(this.apiUrl);
  }

  /**
   * Reemplaza completamente los permisos de un rol.
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Nueva lista de nombres de permisos.
   * @returns Observable con el rol actualizado.
   */
  public updatePermissions(roleId: number, permissions: string[]) {
    return this.http.put<Role>(
      `${this.apiUrl}/${roleId}/permissions`,
      permissions,
    );
  }

  /**
   * Elimina permisos específicos de un rol.
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Lista de nombres de permisos a eliminar.
   * @returns Observable con el rol actualizado.
   */
  public removePermissions(roleId: number, permissions: string[]) {
    return this.http.delete<Role>(
      `${this.apiUrl}/${roleId}/remove-permissions`,
      { body: permissions },
    );
  }
}
