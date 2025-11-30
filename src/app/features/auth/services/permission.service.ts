import { Injectable, signal, WritableSignal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from '../../users/services/user.service';
import {
  combineLatest,
  filter,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { User } from '../../users/models/user.model';
import { environment } from '../../../../environments/environment';
import { Permission } from '../../../shared/models/permission.model';
import { HttpClient } from '@angular/common/http';

/**
 * Servicio que concentra la recuperación y verificación de permisos del usuario
 * autenticado. Expone utilidades reusables para componer lógica de autorización
 * en componentes, directivas y guards.
 */
@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly apiUrl = `${environment.apiUrl}/v1/permissions`;

  private readonly permissionsState: WritableSignal<Permission[]> = signal<
    Permission[]
  >([]);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly http: HttpClient,
  ) {}

  /**
   * Obtiene todos los permisos disponibles en el backend y los almacena en
   * estado reactivo para reusarlos en formularios o pantallas de administración.
   */
  public getAll(): Observable<Permission[]> {
    return this.http
      .get<Permission[]>(this.apiUrl)
      .pipe(tap((permissions) => this.permissionsState.set(permissions)));
  }

  /**
   * Obtener los permisos del usuario autenticado.
   * @returns Un `Observable` que emite un `Set` de nombres de permisos del usuario.
   */
  public getUserPermissions(): Observable<Set<string>> {
    return combineLatest([
      this.authService.isAuthenticated$,
      this.authService.isDoneLoading$,
    ]).pipe(
      filter(([_, isDoneLoading]) => isDoneLoading),
      take(1),
      switchMap(([isAuthenticated, _]) => {
        if (!isAuthenticated) {
          return of(new Set<string>());
        }
        const userId = this.authService.getUserId();
        if (!userId) {
          return of(new Set<string>());
        }
        return this.userService
          .getById(userId)
          .pipe(map((user) => this.extractPermissionsFromUser(user)));
      }),
    );
  }

  /**
   * Construye un conjunto de permisos a partir de la estructura de roles
   * devuelta por el backend.
   *
   * @param user Usuario autenticado con roles y permisos cargados.
   */
  private extractPermissionsFromUser(user: User): Set<string> {
    const permissions = new Set<string>();
    user.roles.forEach((role: any) => {
      role.permissions.forEach((permission: any) => {
        permissions.add(permission.name);
      });
    });
    return permissions;
  }

  /**
   * Verifica si el usuario posee un permiso puntual.
   *
   * @param requiredPermission Permiso requerido (ej. `user:create`).
   */
  public hasPermission(requiredPermission: string): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) => permissions.has(requiredPermission)),
    );
  }

  /**
   * Evalúa si el usuario cuenta con al menos uno de los permisos solicitados.
   *
   * @param requiredPermissions Lista de permisos alternativos.
   */
  public hasAnyPermission(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.some((permission) => permissions.has(permission)),
      ),
    );
  }

  /**
   * Valida que el usuario tenga todos los permisos de la lista.
   *
   * @param requiredPermissions Permisos obligatorios para la operación.
   */
  public hasAllPermissions(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.every((permission) => permissions.has(permission)),
      ),
    );
  }
}
