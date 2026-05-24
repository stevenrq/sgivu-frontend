import { Permission } from './permission.model';

/**
 * Rol de usuario en el sistema SGIVU.
 * Agrupa un conjunto de permisos que determinan las acciones disponibles para el usuario.
 */
export class Role {
  /** Identificador único del rol. */
  id!: number;
  /** Nombre del rol (e.g., `ROLE_ADMIN`, `ROLE_SELLER`). */
  name!: string;
  /** Descripción legible del rol. */
  description!: string;
  /** Conjunto de permisos asociados al rol. */
  permissions!: Set<Permission>;
}
