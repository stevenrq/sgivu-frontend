import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  actionLabel,
  groupPermissionsByResource,
  resourceLabel,
} from './permission-catalog.utils';
import { Permission } from '../../../shared/models/permission.model';

describe('permission-catalog.utils', () => {
  const buildPermission = (name: string, description = ''): Permission =>
    ({ id: 0, name, description }) as Permission;

  describe('resourceLabel()', () => {
    it('Debe traducir un recurso conocido al español', () => {
      expect(resourceLabel('user')).toBe('Usuarios');
      expect(resourceLabel('purchase_sale')).toBe('Compraventas');
    });

    it('Debe devolver el token crudo para un recurso desconocido', () => {
      expect(resourceLabel('unknown')).toBe('unknown');
    });
  });

  describe('actionLabel()', () => {
    it('Debe traducir una acción conocida al español', () => {
      expect(actionLabel('read')).toBe('Ver');
      expect(actionLabel('delete')).toBe('Eliminar');
    });

    it('Debe devolver el token crudo para una acción desconocida', () => {
      expect(actionLabel('archive')).toBe('archive');
    });
  });

  describe('groupPermissionsByResource()', () => {
    it('Debe agrupar los permisos por recurso', () => {
      const groups = groupPermissionsByResource([
        buildPermission('user:read'),
        buildPermission('user:create'),
        buildPermission('vehicle:read'),
      ]);

      expect(groups.length).toBe(2);
      const user = groups.find((group) => group.resource === 'user');
      expect(user?.label).toBe('Usuarios');
      expect(user?.permissions.length).toBe(2);
    });

    it('Debe ordenar los grupos según el orden preferido (user antes que vehicle)', () => {
      const groups = groupPermissionsByResource([
        buildPermission('vehicle:read'),
        buildPermission('user:read'),
      ]);

      expect(groups.map((group) => group.resource)).toEqual([
        'user',
        'vehicle',
      ]);
    });

    it('Debe ordenar las acciones dentro del grupo (read, create, delete)', () => {
      const groups = groupPermissionsByResource([
        buildPermission('user:delete'),
        buildPermission('user:read'),
        buildPermission('user:create'),
      ]);

      expect(
        groups[0].permissions.map((permission) => permission.action),
      ).toEqual(['read', 'create', 'delete']);
    });

    it('Debe enriquecer cada permiso con la etiqueta de su acción y su descripción', () => {
      const groups = groupPermissionsByResource([
        buildPermission('user:read', 'Permite ver usuarios'),
      ]);

      const permission = groups[0].permissions[0];
      expect(permission.name).toBe('user:read');
      expect(permission.action).toBe('read');
      expect(permission.actionLabel).toBe('Ver');
      expect(permission.description).toBe('Permite ver usuarios');
    });

    it('Debe ubicar recursos desconocidos al final con su token crudo', () => {
      const groups = groupPermissionsByResource([
        buildPermission('zeta:read'),
        buildPermission('user:read'),
      ]);

      expect(groups[0].resource).toBe('user');
      expect(groups[groups.length - 1].resource).toBe('zeta');
      expect(groups[groups.length - 1].label).toBe('zeta');
    });

    it('Debe devolver una lista vacía cuando no hay permisos', () => {
      expect(groupPermissionsByResource([])).toEqual([]);
    });
  });

  it('Debe exponer diccionarios de etiquetas para recursos y acciones', () => {
    expect(RESOURCE_LABELS['role']).toBe('Roles');
    expect(ACTION_LABELS['create']).toBe('Crear');
  });
});
