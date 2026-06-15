/**
 * Contrato del access token JWT emitido por `sgivu-auth`.
 * Los campos `sub`, `username`, `rolesAndPermissions` e `isAdmin` son claims personalizados
 * que el authorization server enriquece durante la emisión del token; no forman parte del
 * estándar OAuth2.
 */
export interface AccessTokenPayload {
  aud: string;
  nbf: number;
  scope: string[];
  iss: string;
  exp: number;
  iat: number;
  jti: string;

  /** ID numérico del usuario en `sgivu-user`, inyectado como `sub` del JWT. */
  sub: string;
  username: string;
  /** Roles y permisos aplanados (ej: `['ROLE_ADMIN', 'user:read']`) para evitar consultas adicionales al resource server. */
  rolesAndPermissions: string[];
  /** Permite diferenciar administradores sin inspeccionar la lista de roles. */
  isAdmin: boolean;

  [key: string]: unknown;
}
