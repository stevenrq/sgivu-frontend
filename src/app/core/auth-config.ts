import { AuthConfig } from 'angular-oauth2-oidc';

export const authCodeFlowConfig: AuthConfig = {
  issuer: 'http://127.0.0.1:9000',

  redirectUri: `${window.location.origin}`,

  postLogoutRedirectUri: `${window.location.origin}`,

  clientId: 'angular-client',

  responseType: 'code',

  scope: 'openid profile email phone address offline_access api read write',

  requireHttps: false,

  showDebugInformation: true,
};
