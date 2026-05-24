/**
 * Permiso de acceso en el sistema SGIVU.
 * El formato del nombre sigue el patrón `recurso:accion` (e.g., `user:create`, `vehicle:delete`).
 */
export class Permission {
  /** Identificador único del permiso. */
  id!: number;
  /** Nombre del permiso en formato `recurso:accion`. */
  name!: string;
  /** Descripción legible del permiso. */
  description!: string;
}
