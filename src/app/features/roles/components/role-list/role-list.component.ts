import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { RoleService } from '../../../auth/services/role.service';
import { showErrorAlert } from '../../../../shared/utils/swal-alert.utils';

/**
 * Lista de los roles del sistema con su descripción y número de permisos asignados.
 * Permite navegar al editor de permisos de cada rol (requiere `user:update`).
 *
 * @remarks
 * El backend no soporta crear, renombrar ni eliminar roles; por eso la vista es de solo
 * lectura salvo por la gestión de permisos de cada rol.
 */
@Component({
  selector: 'app-role-list',
  imports: [
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    HasPermissionDirective,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleListComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly destroyRef = inject(DestroyRef);

  /** Roles del sistema (signal de estado del servicio). */
  protected readonly roles = this.roleService.roles;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.roleService
      .findAll()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.error.set('No se pudieron cargar los roles.');
          void showErrorAlert('No se pudieron cargar los roles.');
        },
      });
  }
}
