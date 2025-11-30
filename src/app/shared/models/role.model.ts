import { Permission } from './permission.model';

/**
 * Rol de seguridad que agrupa un conjunto de permisos para asignarlos a usuarios.
 */
export class Role {
  id!: number;
  name!: string;
  description!: string;
  permissions!: Set<Permission>;
}
