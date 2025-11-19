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
/**
 * Encapsula la integración con `angular-oauth2-oidc`, centralizando la lógica
 * de autenticación, manejo de tokens y recuperación del usuario actual. Este
 * servicio sirve como única fuente de verdad para el estado de sesión en toda
 * la aplicación.
 */
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

  /**
   * Realiza la configuración inicial: intenta completar el login silencioso,
   * actualiza el estado de autenticación y, si aplica, recupera al usuario.
   * También marca cuando terminó la carga para que los guards puedan avanzar.
   */
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

  /**
   * Inicia el flujo OAuth 2.0 guardando previamente la ruta destino para
   * retomar la navegación tras un login exitoso.
   *
   * @param redirectUrl - Ruta a la que se redirige después de autenticarse.
   */
  public startLoginFlow(redirectUrl: string = '/dashboard'): void {
    sessionStorage.setItem('postLoginRedirectUrl', redirectUrl);
    this.oauthService.initCodeFlow();
  }

  /**
   * Limpia el estado local de autenticación y delega el cierre de sesión al
   * proveedor OAuth (lo que también revoca tokens en el backend).
   */
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

  /**
   * Decodifica el payload del access token JWT sin validarlo criptográficamente.
   * Sirve para obtener claims personalizados cuando la librería no los expone.
   *
   * @returns Payload del token o `null` si no existe o es inválido.
   */
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

  /**
   * Suscribe los eventos emitidos por `OAuthService` para reaccionar a la
   * recepción/expiración de tokens y errores de sesión en un único punto.
   */
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

  /**
   * Actualiza el estado interno tras recibir nuevos tokens, dispara la carga
   * del usuario autenticado y redirige cuando proviene del callback OAuth.
   */
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

  /**
   * Resetea el estado local cuando ocurre un error en el flujo OAuth y deja un
   * log para facilitar el diagnóstico.
   *
   * @param event - Evento original proporcionado por la librería (si existe).
   */
  private handleAuthError(event?: OAuthEvent): void {
    if (event) console.error('Error de autenticación:', event);

    this.isAuthenticatedSubject$.next(false);
    this.userSubject$.next(null);
  }

  /**
   * Marca la sesión como no autenticada cuando el token expira para que los
   * guards obliguen a relogear.
   */
  private handleTokenExpired(): void {
    this.isAuthenticatedSubject$.next(false);
  }

  /**
   * Evalúa los tokens actuales y comunica el estado de autenticación al resto
   * de la app mediante el `BehaviorSubject`.
   */
  private updateAuthState(): void {
    const isAuthenticated =
      this.hasValidAccessToken() && this.hasValidIdToken();
    this.isAuthenticatedSubject$.next(isAuthenticated);
  }

  /**
   * Recupera la ruta almacenada antes de iniciar sesión y navega hacia ella
   * al completar el callback OAuth.
   */
  private navigateAfterLogin(): void {
    const redirectUrl =
      sessionStorage.getItem('postLoginRedirectUrl') ?? '/dashboard';
    sessionStorage.removeItem('postLoginRedirectUrl');
    this.router.navigateByUrl(redirectUrl, { replaceUrl: true });
  }

  private isOAuthCallback(): boolean {
    return window.location.pathname.includes('/callback');
  }

  /**
   * Obtiene el usuario autenticado desde el backend y lo almacena en el Subject
   * para exponerlo como observable. Regresa una promesa para facilitar awaits.
   *
   * @returns Promesa resuelta cuando finaliza la llamada al backend.
   */
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
