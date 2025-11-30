import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/role.model';
import { HttpClient } from '@angular/common/http';

/**
 * Gestiona roles y sus permisos asociados. Provee métodos simples para
 * administrar asignaciones desde pantallas de seguridad.
 */
@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly apiUrl = `${environment.apiUrl}/v1/roles`;
  private readonly rolesState: WritableSignal<Set<Role>> = signal<Set<Role>>(
    new Set<Role>(),
  );

  constructor(private readonly http: HttpClient) {}

  /**
   * Agrega permisos a un rol determinado sin reemplazar los existentes.
   *
   * @param roleId Identificador del rol.
   * @param permissions Lista de permisos a asociar.
   */
  public addPermissions(roleId: number, permissions: string[]) {
    return this.http.post<Role>(
      `${this.apiUrl}/${roleId}/add-permissions`,
      permissions,
    );
  }

  /**
   * Recupera el catálogo completo de roles desde el backend.
   */
  public findAll() {
    return this.http.get<Set<Role>>(this.apiUrl);
  }

  /**
   * Reemplaza los permisos actuales de un rol por el conjunto indicado.
   *
   * @param roleId Identificador del rol.
   * @param permissions Permisos finales que debe conservar el rol.
   */
  public updatePermissions(roleId: number, permissions: string[]) {
    return this.http.put<Role>(
      `${this.apiUrl}/${roleId}/permissions`,
      permissions,
    );
  }

  /**
   * Elimina permisos específicos de un rol, manteniendo el resto intacto.
   *
   * @param roleId Identificador del rol.
   * @param permissions Permisos a remover.
   */
  public removePermissions(roleId: number, permissions: string[]) {
    return this.http.delete<Role>(
      `${this.apiUrl}/${roleId}/remove-permissions`,
      { body: permissions },
    );
  }
}
