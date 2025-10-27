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

  private extractPermissionsFromUser(user: User): Set<string> {
    const permissions = new Set<string>();
    user.roles.forEach((role: any) => {
      role.permissions.forEach((permission: any) => {
        permissions.add(permission.name);
      });
    });
    return permissions;
  }

  public hasPermission(requiredPermission: string): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) => permissions.has(requiredPermission)),
    );
  }

  public hasAnyPermission(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.some((permission) => permissions.has(permission)),
      ),
    );
  }

  public hasAllPermissions(requiredPermissions: string[]): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map((permissions) =>
        requiredPermissions.every((permission) => permissions.has(permission)),
      ),
    );
  }
}
