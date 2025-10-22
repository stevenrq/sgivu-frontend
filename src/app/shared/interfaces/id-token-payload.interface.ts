/**
 * Interfaz que representa la estructura del payload de un token de identidad (ID Token).
 * Contiene información estándar de OpenID Connect y claims personalizadas.
 */
export interface IdTokenPayload {
  sub: string;
  aud: string;
  azp: string;
  auth_time: number;
  iss: string;
  exp: number;
  iat: number;
  nonce: string;
  jti: string;
  sid: string;

  userId: string;

  [key: string]: any;
}
