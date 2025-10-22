import { AuthConfig, OAuthModuleConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../../environments/environment';

const issuer = environment.issuer;
const apiUrl = environment.apiUrl;
const clientId = environment.clientId;

export const authCodeFlowConfig: AuthConfig = {
  issuer,
  logoutUrl: `${issuer}/connect/logout`,
  tokenEndpoint: `${issuer}/oauth2/token`,
  redirectUri: `${window.location.origin}/callback`,
  postLogoutRedirectUri: `${window.location.origin}/login`,
  clientId,
  responseType: 'code',
  scope: 'openid profile email phone address api read write',
  requireHttps: false,
  showDebugInformation: true,
  useSilentRefresh: true,
};

export const authModuleConfig: OAuthModuleConfig = {
  resourceServer: {
    allowedUrls: [apiUrl],
    sendAccessToken: true,
  },
};
