import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Modal from 'bootstrap/js/dist/modal';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

interface Permission {
  key: string;
  label: string;
}

interface PermissionGroup {
  groupName: string;
  permissions: Permission[];
}

type RolePermissions = Record<string, string[]>;

interface Role {
  id: number;
  name: string;
  description: string;
  userCount: number;
  permissions: RolePermissions;
}

/**
 * Componente de gestión de roles y permisos del sistema.
 * Permite crear, editar y eliminar roles, y asignar/quitar permisos por módulo.
 *
 * @remarks
 * **Pendiente de integración con el backend.**
 * Actualmente opera con datos mock (`MOCK_ROLES`, `MOCK_PERMISSION_GROUPS`).
 * Los modales usan la librería Bootstrap 5 de forma imperativa vía `Modal.getOrCreateInstance`.
 */
@Component({
  selector: 'app-roles-permissions',
  imports: [FormsModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './roles-permissions.component.html',
  styleUrls: ['./roles-permissions.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPermissionsComponent {
  // --- Signal-based state ---

  readonly roles = signal<Role[]>(MOCK_ROLES);
  readonly permissionGroups = signal<PermissionGroup[]>(MOCK_PERMISSION_GROUPS);

  readonly selectedRole = signal<Role | null>(null);
  readonly roleToCreateOrEdit = signal<Partial<Role>>({});
  readonly roleToDelete = signal<Role | null>(null);
  readonly roleModalTitle = signal('Crear Nuevo Rol');

  // --- viewChild refs para modales ---

  private readonly roleModalRef =
    viewChild<ElementRef<HTMLDivElement>>('roleModalEl');
  private readonly permissionsModalRef =
    viewChild<ElementRef<HTMLDivElement>>('permissionsModalEl');
  private readonly deleteModalRef =
    viewChild<ElementRef<HTMLDivElement>>('deleteModalEl');

  // --- Acciones de modal: roles ---

  openCreateRoleModal(): void {
    this.roleToCreateOrEdit.set({ name: '', description: '' });
    this.roleModalTitle.set('Crear Nuevo Rol');
    this.showModal(this.roleModalRef());
  }

  openEditRoleModal(role: Role): void {
    this.roleToCreateOrEdit.set({ ...role });
    this.roleModalTitle.set('Editar Rol');
    this.showModal(this.roleModalRef());
  }

  saveRole(): void {
    const draft = this.roleToCreateOrEdit();
    if (!draft.name || !draft.description) {
      return;
    }

    this.roles.update((current) => {
      if (draft.id) {
        return current.map((r) => (r.id === draft.id ? (draft as Role) : r));
      }
      const newId =
        current.length > 0 ? Math.max(...current.map((r) => r.id)) + 1 : 1;
      return [
        ...current,
        {
          id: newId,
          name: draft.name!,
          description: draft.description!,
          userCount: 0,
          permissions: {},
        },
      ];
    });
    this.hideModal(this.roleModalRef());
  }

  // --- Acciones de modal: eliminar ---

  /**
   * Abre el modal de confirmación de eliminación para el rol indicado.
   *
   * @param role - Rol que se desea eliminar.
   */
  openDeleteModal(role: Role): void {
    this.roleToDelete.set(role);
    this.showModal(this.deleteModalRef());
  }

  confirmDelete(): void {
    const toDelete = this.roleToDelete();
    if (toDelete) {
      this.roles.update((current) =>
        current.filter((r) => r.id !== toDelete.id),
      );
      this.hideModal(this.deleteModalRef());
      this.roleToDelete.set(null);
    }
  }

  // --- Acciones de modal: permisos ---

  /**
   * Abre el modal de gestión de permisos para el rol indicado.
   * Trabaja sobre una copia del rol para evitar mutaciones hasta que el usuario confirme.
   *
   * @param role - Rol al que se gestionarán los permisos.
   */
  openPermissionsModal(role: Role): void {
    this.selectedRole.set({ ...role, permissions: { ...role.permissions } });
    this.showModal(this.permissionsModalRef());
  }

  /**
   * Verifica si el rol seleccionado tiene el permiso indicado.
   *
   * @param permissionKey - Clave del permiso en formato `modulo:accion`.
   * @returns `true` si el rol tiene el permiso; `false` en caso contrario.
   */
  hasPermission(permissionKey: string): boolean {
    const role = this.selectedRole();
    if (!role) return false;
    const [module, action] = permissionKey.split(':');
    return role.permissions[module]?.includes(action) ?? false;
  }

  /**
   * Alterna la asignación de un permiso al rol seleccionado según el estado del checkbox.
   *
   * @param event - Evento nativo del checkbox.
   * @param permissionKey - Clave del permiso en formato `modulo:accion`.
   */
  togglePermission(event: Event, permissionKey: string): void {
    const role = this.selectedRole();
    if (!role) return;
    const [module, action] = permissionKey.split(':');
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;

    const updatedPermissions = { ...role.permissions };
    const modulePerms = [...(updatedPermissions[module] ?? [])];

    if (isChecked && !modulePerms.includes(action)) {
      modulePerms.push(action);
    } else if (!isChecked) {
      const idx = modulePerms.indexOf(action);
      if (idx !== -1) modulePerms.splice(idx, 1);
    }
    updatedPermissions[module] = modulePerms;
    this.selectedRole.set({ ...role, permissions: updatedPermissions });
  }

  savePermissions(): void {
    const role = this.selectedRole();
    if (role) {
      this.roles.update((current) =>
        current.map((r) =>
          r.id === role.id ? { ...r, permissions: role.permissions } : r,
        ),
      );
    }
    this.hideModal(this.permissionsModalRef());
  }

  // --- Utilidades de modal ---

  private showModal(ref: ElementRef<HTMLDivElement> | undefined): void {
    if (!ref) return;
    Modal.getOrCreateInstance(ref.nativeElement).show();
  }

  private hideModal(ref: ElementRef<HTMLDivElement> | undefined): void {
    if (!ref) return;
    Modal.getInstance(ref.nativeElement)?.hide();
  }
}

// --- Datos mock (temporales hasta integración con backend) ---

const MOCK_ROLES: Role[] = [
  {
    id: 1,
    name: 'Administrador',
    description:
      'Acceso total al sistema. Gestiona usuarios, roles y configuraciones.',
    userCount: 2,
    permissions: {
      users: ['read', 'create', 'update', 'delete'],
      vehicles: ['read', 'create', 'update', 'delete'],
      reports: ['read', 'create', 'update', 'delete'],
      predictions: ['read'],
    },
  },
  {
    id: 2,
    name: 'Gerente',
    description:
      'Supervisa operaciones, accede a informes y predicciones de demanda.',
    userCount: 3,
    permissions: {
      users: ['read'],
      vehicles: ['read', 'update'],
      reports: ['read', 'create'],
      predictions: ['read'],
    },
  },
  {
    id: 3,
    name: 'Vendedor',
    description: 'Gestiona la venta de vehículos y la documentación asociada.',
    userCount: 5,
    permissions: {
      users: [],
      vehicles: ['read', 'update'],
      reports: ['read'],
      predictions: [],
    },
  },
  {
    id: 4,
    name: 'Mecánico',
    description:
      'Registra y actualiza el estado de mantenimiento de los vehículos.',
    userCount: 4,
    permissions: {
      users: [],
      vehicles: ['read', 'update'],
      reports: [],
      predictions: [],
    },
  },
];

const MOCK_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    groupName: 'Gestión de Usuarios',
    permissions: [
      { key: 'users:read', label: 'Ver Usuarios' },
      { key: 'users:create', label: 'Crear Usuarios' },
      { key: 'users:update', label: 'Editar Usuarios' },
      { key: 'users:delete', label: 'Eliminar Usuarios' },
    ],
  },
  {
    groupName: 'Gestión de Inventario',
    permissions: [
      { key: 'vehicles:read', label: 'Ver Vehículos' },
      { key: 'vehicles:create', label: 'Registrar Compra de Vehículo' },
      {
        key: 'vehicles:update',
        label: 'Actualizar Vehículo / Registrar Venta',
      },
      { key: 'vehicles:delete', label: 'Eliminar Vehículo del Inventario' },
    ],
  },
  {
    groupName: 'Gestión de Informes y Predicciones',
    permissions: [
      { key: 'reports:read', label: 'Ver Informes' },
      { key: 'reports:create', label: 'Generar Nuevos Informes' },
      { key: 'reports:update', label: 'Personalizar Informes' },
      { key: 'reports:delete', label: 'Eliminar Informes' },
      {
        key: 'predictions:read',
        label: 'Consultar Predicciones de Demanda',
      },
    ],
  },
];
