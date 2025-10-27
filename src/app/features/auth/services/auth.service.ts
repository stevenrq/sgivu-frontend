import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthErrorEvent, OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { BehaviorSubject, combineLatest, map, Observable, tap } from 'rxjs';
import { authCodeFlowConfig } from '../config/auth-config';
import { AccessTokenPayload } from '../../../shared/interfaces/access-token-payload.interface';
import { IdTokenPayload } from '../../../shared/interfaces/id-token-payload.interface';
import { User } from '../../users/models/user.model';
import { UserService } from '../../users/services/user.service';

enum OAuthEventType {
  tokenReceived = 'token_received',
  tokenExpires = 'token_expires',
  tokenError = 'token_error',
  sessionTerminated = 'session_terminated',
  sessionError = 'session_error',
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly isAuthenticatedSubject$ = new BehaviorSubject<boolean>(
    false,
  );

  private readonly isDoneLoadingSubject$ = new BehaviorSubject<boolean>(false);

  private readonly userSubject$ = new BehaviorSubject<User | null>(null);

  public readonly isAuthenticated$: Observable<boolean> =
    this.isAuthenticatedSubject$.asObservable();

  public readonly isDoneLoading$: Observable<boolean> =
    this.isDoneLoadingSubject$.asObservable();

  public readonly currentAuthenticatedUser$: Observable<User | null> =
    this.userSubject$.asObservable();

  /**
   * Un observable que emite `true` cuando la aplicación está lista para interactuar con rutas protegidas.
   *
   * Combina dos estados clave:
   * 1. La autenticación del usuario (`isAuthenticated$`).
   * 2. La finalización de los procesos de carga inicial de la aplicación (`isDoneLoading$`).
   *
   * Este observable es útil no solo para guardas de ruta, sino también para cualquier componente
   * que necesite determinar si debe mostrar el contenido principal de la aplicación o una pantalla de carga.
   *
   * @returns Un `Observable<boolean>` que es `true` si la aplicación está lista y el usuario está autenticado,
   * de lo contrario, `false`.
   */
  public readonly isReadyAndAuthenticated$: Observable<boolean> = combineLatest(
    [this.isAuthenticated$, this.isDoneLoading$],
  ).pipe(
    map(([isAuthenticated, isDoneLoading]) => isAuthenticated && isDoneLoading),
  );

  constructor(
    private readonly oauthService: OAuthService,
    private readonly router: Router,
    private readonly userService: UserService,
  ) {
    this.oauthService.configure(authCodeFlowConfig);
    this.setupOAuthEventListeners();
  }

  public async initializeAuthentication(): Promise<void> {
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
    this.updateAuthState();

    if (this.isAuthenticatedSubject$.value) {
      if (!this.isOAuthCallback()) {
        await this.fetchAndStoreCurrentAuthenticatedUser();
      }
    }

    this.isDoneLoadingSubject$.next(true);
  }

  public startLoginFlow(redirectUrl: string = '/dashboard'): void {
    sessionStorage.setItem('postLoginRedirectUrl', redirectUrl);
    this.oauthService.initCodeFlow();
  }

  public logout(): void {
    this.isAuthenticatedSubject$.next(false);
    this.userSubject$.next(null);
    sessionStorage.removeItem('postLoginRedirectUrl');
    this.oauthService.logOut();
  }

  /**
   * Devuelve un observable que emite el estado de autenticación.
   * Si el usuario no está autenticado, inicia el flujo de inicio de sesión.
   * Este método está diseñado para ser utilizado en guards.
   *
   * @param redirectUrl La URL a la que redirigir después de un inicio de sesión exitoso.
   * @returns Un `Observable<boolean>` que es `true` si está autenticado, `false` en caso contrario.
   */
  public enforceAuthentication(redirectUrl: string): Observable<boolean> {
    return this.isAuthenticated$.pipe(
      tap((isAuthenticated) => {
        if (!isAuthenticated || !this.hasValidAccessToken) {
          this.startLoginFlow(redirectUrl);
        }
      }),
    );
  }

  public hasValidAccessToken(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  public hasValidIdToken(): boolean {
    return this.oauthService.hasValidIdToken();
  }

  public getAccessToken(): string | null {
    return this.oauthService.getAccessToken() ?? null;
  }

  public getIdToken(): string | null {
    return this.oauthService.getIdToken() ?? null;
  }

  private getAccessTokenPayload(): AccessTokenPayload | null {
    const accessToken = this.oauthService.getAccessToken();
    if (!accessToken) {
      return null;
    }

    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) {
      console.error(
        'Error al decodificar el payload del token de acceso:',
        'Formato JWT inválido',
      );
      return null;
    }

    try {
      const payloadBase64 = tokenParts[1];
      const payloadJson = atob(payloadBase64);
      return JSON.parse(payloadJson) as AccessTokenPayload;
    } catch (error) {
      console.error(
        'Error al decodificar el payload del token de acceso:',
        error,
      );
      return null;
    }
  }

  public getIdTokenPayload(): IdTokenPayload | null {
    const claims = this.oauthService.getIdentityClaims();
    if (!claims) {
      return null;
    }
    return claims as IdTokenPayload;
  }

  public getClaimFromAccessToken<T>(
    claimKey: keyof AccessTokenPayload,
  ): T | null {
    const payload = this.getAccessTokenPayload();
    return payload?.[claimKey] ?? null;
  }

  public getCurrentAuthenticatedUser(): User | null {
    return this.userSubject$.value;
  }

  public getClaimFromIdToken<T>(claimKey: keyof IdTokenPayload): T | null {
    const payload = this.getIdTokenPayload();
    return payload?.[claimKey] ?? null;
  }

  public getUserId(): number | null {
    return this.getClaimFromIdToken<number>('userId');
  }

  public getUsername(): string | null {
    return this.getClaimFromAccessToken<string>('username');
  }

  public isAdmin(): boolean {
    return this.getClaimFromAccessToken<boolean>('isAdmin') ?? false;
  }

  public getRolesAndPermissions(): Set<string> {
    return new Set(
      this.getClaimFromAccessToken<string[]>('rolesAndPermissions') ?? [],
    );
  }

  private setupOAuthEventListeners(): void {
    this.oauthService.events.subscribe((event) => {
      switch (event.type) {
        case OAuthEventType.tokenReceived:
          this.handleTokenReceived();
          break;
        case OAuthEventType.tokenError:
        case OAuthEventType.sessionTerminated:
        case OAuthEventType.sessionError:
          this.handleAuthError(event);
          break;
        case OAuthEventType.tokenExpires:
          this.handleTokenExpired();
          break;
        default:
          if (event instanceof OAuthErrorEvent) {
            console.error('Evento de error OAuth no manejado:', event);
          }
      }
    });
  }

  private handleTokenReceived(): void {
    this.updateAuthState();

    this.fetchAndStoreCurrentAuthenticatedUser();
    this.oauthService
      .loadUserProfile()
      .catch((err) =>
        console.error('Error al cargar el perfil de usuario', err),
      );

    if (this.isOAuthCallback()) {
      this.navigateAfterLogin();
    }
  }

  private handleAuthError(event?: OAuthEvent): void {
    if (event) console.error('Error de autenticación:', event);

    this.isAuthenticatedSubject$.next(false);
    this.userSubject$.next(null);
  }

  private handleTokenExpired(): void {
    this.isAuthenticatedSubject$.next(false);
  }

  private updateAuthState(): void {
    const isAuthenticated =
      this.hasValidAccessToken() && this.hasValidIdToken();
    this.isAuthenticatedSubject$.next(isAuthenticated);
  }

  private navigateAfterLogin(): void {
    const redirectUrl =
      sessionStorage.getItem('postLoginRedirectUrl') ?? '/dashboard';
    sessionStorage.removeItem('postLoginRedirectUrl');
    this.router.navigateByUrl(redirectUrl, { replaceUrl: true });
  }

  private isOAuthCallback(): boolean {
    return window.location.pathname.includes('/callback');
  }

  private fetchAndStoreCurrentAuthenticatedUser(): Promise<void> {
    return new Promise((resolve) => {
      const userId = this.getUserId();
      if (!userId) {
        console.warn('No se encontró el ID del usuario en el id_token');
        this.userSubject$.next(null);
        resolve();
        return;
      }

      this.userService.getById(userId).subscribe({
        next: (user) => {
          this.userSubject$.next(user);
          resolve();
        },
        error: (err) => {
          console.error('Falló la obtención del usuario actual', err);
          this.userSubject$.next(null);
          resolve();
        },
      });
    });
  }
}
