import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { of, Subject } from 'rxjs';

import { AuthService } from './auth.service';
import { UserService } from '../../users/services/user.service';
import { User } from '../../users/models/user.model';

class OAuthServiceMock {
  events = new Subject<OAuthEvent>();
  validAccessToken = false;
  validIdToken = false;
  accessToken: string | null = null;
  idToken: string | null = null;
  identityClaims: Record<string, unknown> | null = null;

  configure = jasmine.createSpy('configure');
  loadDiscoveryDocumentAndTryLogin = jasmine
    .createSpy('loadDiscoveryDocumentAndTryLogin')
    .and.resolveTo();
  hasValidAccessToken = jasmine
    .createSpy('hasValidAccessToken')
    .and.callFake(() => this.validAccessToken);
  hasValidIdToken = jasmine
    .createSpy('hasValidIdToken')
    .and.callFake(() => this.validIdToken);
  getAccessToken = jasmine
    .createSpy('getAccessToken')
    .and.callFake(() => this.accessToken);
  getIdToken = jasmine.createSpy('getIdToken').and.callFake(() => this.idToken);
  getIdentityClaims = jasmine
    .createSpy('getIdentityClaims')
    .and.callFake(() => this.identityClaims);
  initCodeFlow = jasmine.createSpy('initCodeFlow');
  logOut = jasmine.createSpy('logOut');
  loadUserProfile = jasmine.createSpy('loadUserProfile').and.resolveTo({});
}

describe('AuthService', () => {
  let service: AuthService;
  let oauthService: OAuthServiceMock;
  let userService: jasmine.SpyObj<UserService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    oauthService = new OAuthServiceMock();
    userService = jasmine.createSpyObj<UserService>('UserService', ['getById']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: OAuthService, useValue: oauthService },
        { provide: UserService, useValue: userService },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('inicializa autenticación, marca estados y obtiene el usuario', async () => {
    const user: User = {
      id: 99,
      nationalId: 123,
      firstName: 'Ada',
      lastName: 'Lovelace',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      phoneNumber: 123,
      username: 'ada',
      email: 'ada@example.com',
      roles: new Set(),
      enabled: true,
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      admin: false,
    };
    oauthService.validAccessToken = true;
    oauthService.validIdToken = true;
    oauthService.identityClaims = { userId: user.id };
    userService.getById.and.returnValue(of(user));

    await service.initializeAuthentication();

    expect(oauthService.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalled();
    expect(service.getCurrentAuthenticatedUser()).toEqual(user);
    expect(
      (service as any).isAuthenticatedSubject$.getValue(),
    ).toBeTrue();
    expect((service as any).isDoneLoadingSubject$.getValue()).toBeTrue();
  });

  it('inicia el flujo de login guardando la ruta de retorno', () => {
    service.startLoginFlow('/secure');

    expect(sessionStorage.getItem('postLoginRedirectUrl')).toBe('/secure');
    expect(oauthService.initCodeFlow).toHaveBeenCalled();
  });

  it('limpia el estado y llama logout del proveedor', () => {
    (service as any).isAuthenticatedSubject$.next(true);
    (service as any).userSubject$.next({
      id: 1,
      nationalId: 1,
      firstName: 'Test',
      lastName: 'User',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      phoneNumber: 123,
      username: 'test',
      email: 't@example.com',
      roles: new Set(),
      enabled: true,
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      admin: false,
    });
    sessionStorage.setItem('postLoginRedirectUrl', '/dashboard');

    service.logout();

    expect((service as any).isAuthenticatedSubject$.getValue()).toBeFalse();
    expect((service as any).userSubject$.getValue()).toBeNull();
    expect(sessionStorage.getItem('postLoginRedirectUrl')).toBeNull();
    expect(oauthService.logOut).toHaveBeenCalled();
  });

  it('decodifica claims del access token de forma segura', () => {
    const payload = { username: 'ada', isAdmin: true };
    const token = [
      btoa(JSON.stringify({ alg: 'none' })),
      btoa(JSON.stringify(payload)),
      'signature',
    ].join('.');
    oauthService.accessToken = token;

    expect(service.getClaimFromAccessToken('username')).toBe('ada');
    expect(service.getClaimFromAccessToken('isAdmin')).toBeTrue();
  });

  it('enforceAuthentication dispara login cuando no está autenticado', (done) => {
    spyOn(service, 'startLoginFlow');

    service.enforceAuthentication('/private').subscribe(() => {
      expect(service.startLoginFlow).toHaveBeenCalledWith('/private');
      done();
    });
  });
});
