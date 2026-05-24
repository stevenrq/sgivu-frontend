/**
 * Contrato del ID token OIDC emitido por `sgivu-auth`.
 * `userId` es un claim personalizado que contiene el ID numérico del usuario,
 * necesario porque `sub` en OIDC es opaco y no siempre coincide con el ID de dominio.
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

  /** ID de dominio del usuario en `sgivu-user`, diferente del `sub` OIDC. */
  userId: string;

  [key: string]: unknown;
}
