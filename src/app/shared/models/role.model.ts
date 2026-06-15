import { Permission } from './permission.model';

/**
 * Rol de usuario en el sistema SGIVU.
 * Agrupa un conjunto de permisos que determinan las acciones disponibles para el usuario.
 */
export class Role {
  /** Identificador único del rol. */
  id!: number;
  /** Nombre del rol (e.g., `ADMIN`, `USER`). Sin el prefijo `ROLE_`, que solo existe dentro del JWT. */
  name!: string;
  /** Descripción legible del rol. */
  description!: string;
  /** Permisos asociados al rol (array tal como lo serializa el backend). */
  permissions!: Permission[];
}
