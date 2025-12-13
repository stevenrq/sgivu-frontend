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
