/**
 * Interfaz que representa la estructura del payload de un token de acceso (Access Token).
 * Contiene información estándar de JWT y claims personalizadas.
 */
export interface AccessTokenPayload {
  aud: string;
  nbf: number;
  scope: string[];
  iss: string;
  exp: number;
  iat: number;
  jti: string;

  sub: string;
  username: string;
  rolesAndPermissions: string[];
  isAdmin: boolean;

  [key: string]: any;
}
