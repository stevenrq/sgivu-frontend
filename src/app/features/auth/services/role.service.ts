import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/role.model';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Servicio de acceso a los roles del sistema y la gestión de sus permisos.
 * Mantiene un signal de estado con los roles cargados para reutilizarlo entre vistas
 * (la lista y el editor de permisos) y evitar peticiones redundantes.
 */
@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/roles`;

  /** Estado interno con los roles cargados desde el backend. */
  private readonly _roles = signal<Role[]>([]);

  /** Roles del sistema expuestos como signal de solo lectura. */
  readonly roles = this._roles.asReadonly();

  /**
   * Obtiene todos los roles del sistema y los almacena en el signal de estado.
   *
   * @returns Observable con la lista de roles.
   */
  public findAll(): Observable<Role[]> {
    return this.http
      .get<Role[]>(this.apiUrl)
      .pipe(tap((roles) => this._roles.set(roles)));
  }

  /**
   * Agrega permisos a un rol existente (unión — no reemplaza los existentes).
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Lista de nombres de permisos a agregar.
   * @returns Observable con el rol actualizado.
   */
  public addPermissions(
    roleId: number,
    permissions: string[],
  ): Observable<Role> {
    return this.http
      .post<Role>(`${this.apiUrl}/${roleId}/add-permissions`, permissions)
      .pipe(tap((role) => this.syncRole(role)));
  }

  /**
   * Reemplaza completamente los permisos de un rol.
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Nueva lista de nombres de permisos.
   * @returns Observable con el rol actualizado.
   */
  public updatePermissions(
    roleId: number,
    permissions: string[],
  ): Observable<Role> {
    return this.http
      .put<Role>(`${this.apiUrl}/${roleId}/permissions`, permissions)
      .pipe(tap((role) => this.syncRole(role)));
  }

  /**
   * Elimina permisos específicos de un rol.
   *
   * @param roleId - Identificador del rol.
   * @param permissions - Lista de nombres de permisos a eliminar.
   * @returns Observable con el rol actualizado.
   */
  public removePermissions(
    roleId: number,
    permissions: string[],
  ): Observable<Role> {
    return this.http
      .delete<Role>(`${this.apiUrl}/${roleId}/remove-permissions`, {
        body: permissions,
      })
      .pipe(tap((role) => this.syncRole(role)));
  }

  /**
   * Reemplaza en el estado el rol cuyo `id` coincide con el rol recibido.
   * Si el rol no existe aún en el estado, lo agrega.
   *
   * @param updated - Rol actualizado devuelto por el backend.
   */
  private syncRole(updated: Role): void {
    this._roles.update((current) => {
      const exists = current.some((role) => role.id === updated.id);
      return exists
        ? current.map((role) => (role.id === updated.id ? updated : role))
        : [...current, updated];
    });
  }
}
