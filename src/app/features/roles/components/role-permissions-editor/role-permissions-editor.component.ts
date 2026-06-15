import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize, forkJoin, of } from 'rxjs';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import { Role } from '../../../../shared/models/role.model';
import { Permission } from '../../../../shared/models/permission.model';
import { RoleService } from '../../../auth/services/role.service';
import { PermissionService } from '../../../auth/services/permission.service';
import {
  PermissionGroup,
  groupPermissionsByResource,
} from '../../utils/permission-catalog.utils';
import {
  showConfirmDialog,
  showErrorAlert,
  showSuccessAlert,
} from '../../../../shared/utils/swal-alert.utils';

/**
 * Editor de permisos de un rol en página dedicada.
 * Carga el catálogo completo de permisos agrupado por recurso y la selección actual del rol;
 * al guardar reemplaza el conjunto completo de permisos del rol (`PUT /v1/roles/{id}/permissions`).
 */
@Component({
  selector: 'app-role-permissions-editor',
  imports: [FormShellComponent],
  templateUrl: './role-permissions-editor.component.html',
  styleUrl: './role-permissions-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly role = signal<Role | null>(null);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly query = signal('');

  /** Catálogo de permisos del sistema. */
  private readonly catalog = signal<Permission[]>([]);
  /** Nombres de permisos seleccionados para el rol. */
  private readonly selected = signal<Set<string>>(new Set<string>());

  /** Grupos de permisos del catálogo, ordenados y traducidos. */
  protected readonly groups = computed(() =>
    groupPermissionsByResource(this.catalog()),
  );

  /** Grupos filtrados por el término de búsqueda. */
  protected readonly filteredGroups = computed(() => {
    const term = this.query().trim().toLowerCase();
    const groups = this.groups();
    if (!term) {
      return groups;
    }
    return groups
      .map((group) => {
        if (
          group.label.toLowerCase().includes(term) ||
          group.resource.includes(term)
        ) {
          return group;
        }
        return {
          ...group,
          permissions: group.permissions.filter(
            (permission) =>
              permission.name.toLowerCase().includes(term) ||
              permission.actionLabel.toLowerCase().includes(term) ||
              permission.description.toLowerCase().includes(term),
          ),
        };
      })
      .filter((group) => group.permissions.length > 0);
  });

  protected readonly selectedCount = computed(() => this.selected().size);

  protected readonly title = computed(() => {
    const role = this.role();
    return role ? `Editar permisos · ${role.name}` : 'Editar permisos';
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!idParam || Number.isNaN(id)) {
      void showErrorAlert('El identificador del rol no es válido.');
      void this.router.navigate(['/roles-permissions']);
      return;
    }
    this.loadData(id);
  }

  /**
   * Carga el rol y el catálogo de permisos, reutilizando los signals de estado cuando ya
   * están poblados (navegación desde la lista) o pidiéndolos al backend (acceso directo).
   */
  private loadData(id: number): void {
    this.loading.set(true);

    const roles$: Observable<Role[]> = this.roleService.roles().length
      ? of(this.roleService.roles())
      : this.roleService.findAll();
    const permissions$: Observable<Permission[]> =
      this.permissionService.permissions().length
        ? of(this.permissionService.permissions())
        : this.permissionService.getAll();

    forkJoin([roles$, permissions$])
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ([roles, permissions]) => {
          const role = roles.find((candidate) => candidate.id === id);
          if (!role) {
            void showErrorAlert('El rol solicitado no existe.');
            void this.router.navigate(['/roles-permissions']);
            return;
          }
          this.role.set(role);
          this.catalog.set(permissions);
          this.selected.set(
            new Set(role.permissions.map((permission) => permission.name)),
          );
        },
        error: () => {
          void showErrorAlert('No se pudieron cargar los datos del rol.');
          void this.router.navigate(['/roles-permissions']);
        },
      });
  }

  protected isSelected(name: string): boolean {
    return this.selected().has(name);
  }

  protected isGroupFullySelected(group: PermissionGroup): boolean {
    return (
      group.permissions.length > 0 &&
      group.permissions.every((permission) =>
        this.selected().has(permission.name),
      )
    );
  }

  protected isGroupPartiallySelected(group: PermissionGroup): boolean {
    const selectedInGroup = group.permissions.filter((permission) =>
      this.selected().has(permission.name),
    ).length;
    return selectedInGroup > 0 && selectedInGroup < group.permissions.length;
  }

  protected toggle(name: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  protected toggleGroup(group: PermissionGroup, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      for (const permission of group.permissions) {
        if (checked) {
          next.add(permission.name);
        } else {
          next.delete(permission.name);
        }
      }
      return next;
    });
  }

  protected onCancel(): void {
    void this.router.navigate(['/roles-permissions']);
  }

  protected async onSave(): Promise<void> {
    const role = this.role();
    if (!role) {
      return;
    }

    const confirmation = await showConfirmDialog({
      title: 'Actualizar permisos',
      text: `Se reemplazarán los permisos del rol ${role.name} por la selección actual.`,
      confirmText: 'Sí, guardar',
      icon: 'question',
    });
    if (!confirmation.isConfirmed) {
      return;
    }

    this.submitting.set(true);
    this.roleService
      .updatePermissions(role.id, Array.from(this.selected()))
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void showSuccessAlert('Permisos actualizados correctamente.');
          void this.router.navigate(['/roles-permissions']);
        },
        error: () => {
          void showErrorAlert('No se pudieron actualizar los permisos.');
        },
      });
  }
}
