import { Injectable, signal, WritableSignal, inject } from '@angular/core';
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
import { Role } from '../../../shared/models/role.model';
import { HttpClient } from '@angular/common/http';

/**
 * Servicio de permisos del usuario autenticado.
 * Los permisos no se obtienen directamente de un endpoint; se derivan aplanando
 * la jerarquía `User → Role[] → Permission[]` del usuario actual.
 */
@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/permissions`;

  private readonly permissionsState: WritableSignal<Permission[]> = signal<
    Permission[]
  >([]);

  /**
   * Obtiene todos los permisos del sistema y los almacena en el signal de estado.
   *
   * @returns Observable con la lista completa de permisos.
   */
  public getAll(): Observable<Permission[]> {
    return this.http
      .get<Permission[]>(this.apiUrl)
      .pipe(tap((permissions) => this.permissionsState.set(permissions)));
  }

  /**
   * Espera a que la autenticación termine de cargarse antes de extraer permisos.
   * Sin este `filter + take(1)`, el observable se resolvería antes de que `AuthService`
   * complete la validación de sesión, devolviendo un `Set` vacío erróneamente.
   *
   * @returns Set de nombres de permisos del usuario autenticado. Empty si no hay sesión.
   */
  public getUserPermissions(): Observable<Set<string>> {
    return combineLatest([
      this.authService.isAuthenticated$,
      this.authService.isDoneLoading$,
    ]).pipe(
      filter(([, isDoneLoading]) => isDoneLoading),
      take(1),
      switchMap(([isAuthenticated]) => {
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

  /** Aplana `roles → permissions` en un `Set<string>` para lookup O(1) en guards y directivas.
   *
   * @param user Usuario del que extraer permisos.
   * @returns Set de nombres de permisos del usuario.
   */
  private extractPermissionsFromUser(user: User): Set<string> {
    const permissions = new Set<string>();
    user.roles.forEach((role: Role) => {
      role.permissions.forEach((permission: Permission) => {
        permissions.add(permission.name);
      });
    });
    return permissions;
  }

  /**
   * Verifica si el usuario autenticado tiene un permiso específico.
   *
   * @param requiredPermission - Nombre del permiso en formato `recurso:accion`.
   * @returns Observable que emite `true` si el usuario tiene el permiso.
   */
  public hasPermission(requiredPermission: string): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) => permissions.has(requiredPermission)),
    );
  }

  /**
   * Verifica si el usuario autenticado tiene al menos uno de los permisos indicados (lógica OR).
   *
   * @param requiredPermissions - Lista de permisos a verificar.
   * @returns Observable que emite `true` si el usuario tiene alguno de los permisos.
   */
  public hasAnyPermission(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.some((permission) => permissions.has(permission)),
      ),
    );
  }

  /**
   * Verifica si el usuario autenticado tiene todos los permisos indicados (lógica AND).
   *
   * @param requiredPermissions - Lista de permisos a verificar.
   * @returns Observable que emite `true` si el usuario tiene todos los permisos.
   */
  public hasAllPermissions(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.every((permission) => permissions.has(permission)),
      ),
    );
  }
}
