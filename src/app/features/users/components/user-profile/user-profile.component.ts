import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { PermissionService } from '../../../auth/services/permission.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';

/**
 * Página de detalle del perfil de un usuario.
 * Carga el usuario por `id` de la ruta o, si no hay parámetro, muestra el perfil del usuario autenticado.
 * Expone acciones de edición, cambio de estado y eliminación condicionadas por permisos.
 */
@Component({
  selector: 'app-user-profile',
  imports: [NgClass, RouterLink, HasPermissionDirective],
  templateUrl: './user-profile.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './user-profile.component.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly userUiHelper = inject(UserUiHelperService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  protected readonly user = signal<User | null>(null);
  protected readonly canEdit = signal(false);
  protected readonly isOwnProfile = signal(false);
  protected readonly canManageRolePermissions = signal(false);
  protected readonly userPermissionNames = signal<Set<string>>(
    new Set<string>(),
  );

  ngOnInit(): void {
    this.permissionService
      .getUserPermissions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((permissions) => {
        this.userPermissionNames.set(permissions);
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idString = params.get('id');
        if (idString) {
          const id = Number(idString);
          if (Number.isNaN(id)) {
            this.router.navigateByUrl('/users');
          } else {
            this.loadUserData(id);
          }
        } else {
          const user = this.authService.currentAuthenticatedUser();
          if (user) {
            this.isOwnProfile.set(true);
            this.loadUserData(user.id);
          }
        }
      });
  }

  private loadUserData(id: number): void {
    this.userService
      .getById(id)
      .pipe(
        switchMap((user) => {
          user.roles = new Set(user.roles);
          this.user.set(user);
          return this.permissionService.getUserPermissions();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (permissions) => {
          this.canEdit.set(
            this.isOwnProfile() || permissions.has('user:update'),
          );
          this.canManageRolePermissions.set(permissions.has('role:update'));
        },
        error: () => {
          this.toast.error('No se pudo cargar el perfil del usuario.');
          this.router.navigateByUrl('/users');
        },
      });
  }

  /**
   * Solicita confirmación y cambia el estado habilitado/deshabilitado del usuario.
   *
   * @param id - Identificador del usuario.
   * @param status - Estado actual (`true` = activo).
   */
  public updateStatus(id: number, status: boolean): void {
    this.userUiHelper.updateStatus(id, status, () =>
      this.loadUserData(this.user()!.id),
    );
  }

  /**
   * Solicita confirmación y elimina el usuario indicado.
   *
   * @param id - Identificador del usuario a eliminar.
   */
  public deleteUser(id: number): void {
    this.userUiHelper.delete(id, () => this.loadUserData(this.user()!.id));
  }
}
