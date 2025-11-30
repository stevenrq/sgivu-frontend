import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
import Swal from 'sweetalert2';
import { PermissionService } from '../../../auth/services/permission.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule, RouterLink, HasPermissionDirective],
  templateUrl: './user-profile.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './user-profile.component.css',
  ],
})
/** Perfil de usuario que muestra datos personales, permisos y opciones de administración. */
export class UserProfileComponent implements OnInit {
  protected user: User | null = null;
  protected canEdit = false;
  protected isOwnProfile = false;
  protected canManageRolePermissions = false;
  protected userPermissionNames: Set<string> = new Set();

  protected readonly permissionMap: { [key: string]: string } = {
    'user:create': 'Crear Usuarios',
    'user:read': 'Leer Usuarios',
    'user:update': 'Actualizar Usuarios',
    'user:delete': 'Eliminar Usuarios',
    'role:create': 'Crear Roles',
    'role:read': 'Leer Roles',
    'role:update': 'Actualizar Roles',
    'role:delete': 'Eliminar Roles',
    'permission:create': 'Crear Permisos',
    'permission:read': 'Leer Permisos',
    'permission:update': 'Actualizar Permisos',
    'permission:delete': 'Eliminar Permisos',
    'person:create': 'Crear Personas',
    'person:read': 'Leer Personas',
    'person:update': 'Actualizar Personas',
    'person:delete': 'Eliminar Personas',
    'company:create': 'Crear Compañías',
    'company:read': 'Leer Compañías',
    'company:update': 'Actualizar Compañías',
    'company:delete': 'Eliminar Compañías',
    'vehicle:create': 'Crear Vehículos',
    'vehicle:read': 'Leer Vehículos',
    'vehicle:update': 'Actualizar Vehículos',
    'vehicle:delete': 'Eliminar Vehículos',
    'car:create': 'Crear Vehículos',
    'car:read': 'Leer Vehículos',
    'car:update': 'Actualizar Vehículos',
    'car:delete': 'Eliminar Vehículos',
    'motorcycle:create': 'Crear Motocicletas',
    'motorcycle:read': 'Leer Motocicletas',
    'motorcycle:update': 'Actualizar Motocicletas',
    'motorcycle:delete': 'Eliminar Motocicletas',
    'purchase_sale:create': 'Crear Compras/Ventas',
    'purchase_sale:read': 'Leer Compras/Ventas',
    'purchase_sale:update': 'Actualizar Compras/Ventas',
    'purchase_sale:delete': 'Eliminar Compras/Ventas',
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
    private readonly router: Router,
    private readonly userUiHelper: UserUiHelperService,
  ) {}

  ngOnInit(): void {
    this.permissionService.getUserPermissions().subscribe((permissions) => {
      this.userPermissionNames = permissions;
    });

    this.route.paramMap.subscribe((params) => {
      const idString = params.get('id');
      if (idString) {
        const id = Number(idString);
        if (!isNaN(id)) {
          this.loadUserData(id);
        } else {
          this.router.navigateByUrl('/users');
        }
      } else {
        this.authService.currentAuthenticatedUser$.subscribe({
          next: (user) => {
            if (user) {
              this.isOwnProfile = true;
              this.loadUserData(user.id);
            }
          },
          error: (err) => {
            console.error(err);
          },
        });
      }
    });
  }

  private loadUserData(id: number): void {
    this.userService.getById(id).subscribe({
      next: (user) => {
        this.user = user;
        this.user.roles = new Set(user.roles);
        this.permissionService.getUserPermissions().subscribe((permissions) => {
          this.canEdit = this.isOwnProfile || permissions.has('user:update');
          this.canManageRolePermissions = permissions.has('role:update');
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el perfil del usuario.',
          confirmButtonColor: '#d33',
        });
        this.router.navigateByUrl('/users');
      },
    });
  }

  public updateStatus(id: number, status: boolean): void {
    this.userUiHelper.updateStatus(id, status, () =>
      this.loadUserData(this.user!.id),
    );
  }

  public deleteUser(id: number): void {
    this.userUiHelper.delete(id, () => this.loadUserData(this.user!.id));
  }
}
