import {
  DestroyRef,
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  EMPTY,
  Observable,
  catchError,
  firstValueFrom,
  fromEvent,
  merge,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { User } from '../../users/models/user.model';
import { UserService } from '../../users/services/user.service';
import { ServiceHealthService } from '../../../shared/services/service-health.service';
import { environment } from '../../../../environments/environment';

interface AuthSessionResponse {
  authenticated: boolean;
  userId: string;
  username: string | null;
  rolesAndPermissions: string[];
  isAdmin: boolean;
}

/**
 * Servicio de autenticación que maneja el estado de sesión del usuario.
 * Proporciona métodos para iniciar el flujo de login, cerrar sesión,
 * y obtener información del usuario autenticado.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly serviceHealth = inject(ServiceHealthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly apiUrl = environment.apiUrl;
  private static readonly SESSION_KEEPALIVE_INTERVAL_MS = 20 * 60 * 1000;

  // --- Signals como fuente de verdad ---

  private readonly _isAuthenticated = signal(false);
  private readonly _isDoneLoading = signal(false);
  private readonly _user = signal<User | null>(null);
  private readonly _session = signal<AuthSessionResponse | null>(null);
  // Indica que un `startLoginFlow` fue suprimido por gateway down y debe
  // reintentarse cuando el gateway se recupere.
  private readonly _loginPending = signal(false);
  // Previene llamadas concurrentes a `startLoginFlow`: el método es async y puede
  // ser invocado simultáneamente desde el guard, el interceptor y el effect del
  // constructor. Sin este flag, múltiples `redirectTo()` se dispararían en cadena,
  // causando recargas rápidas de la página.
  private _loginFlowInProgress = false;
  // Indica que un `logout` fue suprimido por servicios down y debe completarse
  // (redirect real a `/logout` para invalidar la sesión del gateway y de auth)
  // cuando ambos servicios se recuperen.
  private readonly _logoutPending = signal(false);

  // --- Signals de solo lectura ---

  public readonly isAuthenticated: Signal<boolean> =
    this._isAuthenticated.asReadonly();

  public readonly isDoneLoading: Signal<boolean> =
    this._isDoneLoading.asReadonly();

  public readonly currentAuthenticatedUser: Signal<User | null> =
    this._user.asReadonly();

  /** Indica si hay un logout pendiente de completar al recuperarse los servicios. */
  public readonly logoutPending: Signal<boolean> =
    this._logoutPending.asReadonly();

  // --- Computed signals ---

  public readonly isReadyAndAuthenticated = computed(
    () => this._isAuthenticated() && this._isDoneLoading(),
  );

  public readonly userId = computed<number | null>(() => {
    const id = this._session()?.userId;
    if (!id) return null;
    const parsed = Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  });

  public readonly username = computed<string | null>(
    () => this._session()?.username ?? null,
  );

  public readonly admin = computed<boolean>(
    () => this._session()?.isAdmin ?? false,
  );

  public readonly rolesAndPermissions = computed<Set<string>>(
    () => new Set(this._session()?.rolesAndPermissions ?? []),
  );

  // --- Observable wrappers para guards e interceptors ---

  /** Observable del estado de autenticación — usado en guards e interceptores. */
  public readonly isAuthenticated$ = toObservable(this._isAuthenticated);
  /** Observable que emite `true` cuando el APP_INITIALIZER de auth ha terminado. */
  public readonly isDoneLoading$ = toObservable(this._isDoneLoading);

  constructor() {
    // Cuando gateway y auth se recuperan, completa cualquier acción pendiente
    // que se suprimió durante la caída. El logout tiene prioridad sobre login:
    // si ambos están pendientes, completar primero la invalidación de la sesión.
    effect(() => {
      const gatewayUp = this.serviceHealth.gatewayStatus() === 'up';
      const authUp = this.serviceHealth.authStatus() === 'up';
      if (!gatewayUp || !authUp) return;

      if (this._logoutPending()) {
        this._logoutPending.set(false);
        this._loginPending.set(false);
        this.redirectTo(`${this.apiUrl}/logout`);
        return;
      }
      if (this._loginPending() && !this._isAuthenticated()) {
        const redirectUrl =
          sessionStorage.getItem('postLoginRedirectUrl') ?? '/dashboard';
        void this.startLoginFlow(redirectUrl);
      }
    });
  }

  /** Retorna el usuario autenticado actual, o `null` si no hay sesión. */
  public getCurrentAuthenticatedUser(): User | null {
    return this._user();
  }

  /** Retorna el ID numérico del usuario autenticado, o `null` si no hay sesión. */
  public getUserId(): number | null {
    return this.userId();
  }

  /** Retorna el nombre de usuario del usuario autenticado, o `null` si no hay sesión. */
  public getUsername(): string | null {
    return this.username();
  }

  /** Retorna `true` si el usuario autenticado tiene rol de administrador. */
  public isAdmin(): boolean {
    return this.admin();
  }

  /** Retorna el `Set` de roles y permisos del usuario autenticado. */
  public getRolesAndPermissions(): Set<string> {
    return this.rolesAndPermissions();
  }

  /**
   * Consulta el estado de sesión en el gateway (BFF) para decidir si el usuario está autenticado.
   * Si existe sesión, carga los datos del usuario y aplica la navegación post-login.
   */
  public async initializeAuthentication(): Promise<void> {
    // Probe directo en paralelo al check de sesión: detecta `sgivu-auth` caído
    // aún si el gateway responde con sesión Redis válida.
    void this.serviceHealth.checkAuthHealthDirect();

    try {
      const session = await firstValueFrom(
        this.http.get<AuthSessionResponse>(`${this.apiUrl}/auth/session`).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 0 || error.status >= 500) {
              console.error('Gateway or auth service unreachable', error);
              this.serviceHealth.markGatewayDown();
            } else if (error.status === 401) {
              // 401 confirma que el gateway está vivo: simplemente no hay sesión.
              this.serviceHealth.markGatewayUp();
            } else {
              console.error('Error validating session on the gateway', error);
            }
            return of(null);
          }),
        ),
      );

      if (session?.authenticated) {
        this.serviceHealth.markGatewayUp();
        this.serviceHealth.markAuthUp();
        this._session.set(session);
        this._isAuthenticated.set(true);
        await this.fetchAndStoreCurrentAuthenticatedUser();
        if (this.isLoginCallback()) {
          this.navigateAfterLogin();
        }
      } else {
        this._session.set(null);
        this._isAuthenticated.set(false);
      }
    } finally {
      this._isDoneLoading.set(true);
    }
    this.startSessionKeepalive();
    this.serviceHealth.startAuthLivenessProbe(() => this._isAuthenticated());
  }

  /**
   * Inicia el flujo OAuth 2.0 delegando el login al gateway.
   * Antes de redirigir consulta el estado real de ambos servicios (probe
   * directo + chequeo del gateway) para evitar el caso típico de race:
   * el usuario hace click justo en los segundos entre probes periódicos
   * mientras `sgivu-auth` acaba de caer, y el redirect rebotaría a un auth
   * server inalcanzable (`ERR_CONNECTION_REFUSED`).
   *
   * Si gateway o auth no responden, suprime la redirección y queda
   * `_loginPending = true`; el effect del constructor reintentará automáticamente
   * cuando ambos servicios vuelvan.
   *
   * @param redirectUrl - Ruta a la que se redirige después de autenticarse.
   */
  public async startLoginFlow(redirectUrl = '/dashboard'): Promise<void> {
    if (this._loginFlowInProgress) return;
    this._loginFlowInProgress = true;
    try {
      sessionStorage.setItem('postLoginRedirectUrl', redirectUrl);
      // Si el usuario decide loguearse, cancela cualquier logout pendiente:
      // querer entrar de nuevo implica abandonar la limpieza diferida.
      this._logoutPending.set(false);

      await this.refreshServiceHealth();
      const gatewayDown = this.serviceHealth.gatewayStatus() === 'down';
      const authDown = this.serviceHealth.authStatus() === 'down';
      if (gatewayDown || authDown) {
        this._loginPending.set(true);
        return;
      }
      this._loginPending.set(false);
      this.redirectTo(`${this.apiUrl}/oauth2/authorization/sgivu-gateway`);
    } finally {
      this._loginFlowInProgress = false;
    }
  }

  /**
   * Limpia el estado local de autenticación y delega el cierre de sesión al gateway.
   * Antes de redirigir, refresca el estado de salud para evitar el race típico
   * (auth acaba de caer en el intervalo entre probes periódicos). Si gateway o
   * auth no responden, se realiza solo el cierre local: redirigir a
   * `${apiUrl}/logout` haría que el gateway rebote al navegador hacia
   * `${issuer}/connect/logout`, rompiendo la SPA con `ERR_CONNECTION_REFUSED`.
   */
  public async logout(): Promise<void> {
    this._isAuthenticated.set(false);
    this._session.set(null);
    this._user.set(null);
    sessionStorage.removeItem('postLoginRedirectUrl');

    await this.refreshServiceHealth();
    const gatewayDown = this.serviceHealth.gatewayStatus() === 'down';
    const authDown = this.serviceHealth.authStatus() === 'down';
    if (gatewayDown || authDown) {
      console.warn(
        'Deferring full OAuth logout: gateway or auth unavailable. Local session cleared.',
      );
      // Marca el logout como pendiente: cuando ambos servicios vuelvan, el
      // effect del constructor ejecutará el redirect real a `/logout` para
      // invalidar la sesión Redis del gateway y la sesión de auth.
      this._logoutPending.set(true);
      // Navega a la página de login para evitar dejar al usuario viendo
      // contenido autenticado mientras el estado local dice "no autenticado".
      void this.router.navigateByUrl('/login');
      return;
    }
    this.redirectTo(`${this.apiUrl}/logout`);
  }

  /**
   * Dispara un chequeo síncrono de gateway y auth para refrescar el estado
   * antes de tomar decisiones críticas (login/logout). Cualquier fallo en el
   * propio chequeo se traga: los métodos `check*` ya actualizan los signals.
   */
  private async refreshServiceHealth(): Promise<void> {
    await Promise.all([
      firstValueFrom(this.serviceHealth.checkGatewayHealth()).catch(
        () => false,
      ),
      this.serviceHealth.checkAuthHealthDirect(),
    ]);
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
        if (!isAuthenticated) {
          void this.startLoginFlow(redirectUrl);
        }
      }),
    );
  }

  // --- Métodos privados ---

  private redirectTo(url: string): void {
    window.location.assign(url);
  }

  /**
   * Determina si la ruta actual es el callback. Lo que significa que el usuario acaba de autenticarse.
   * @returns `true` si la ruta actual es el callback de login, `false` en caso contrario.
   */
  private isLoginCallback(): boolean {
    return window.location.pathname.includes('/callback');
  }

  private navigateAfterLogin(): void {
    const redirectUrl =
      sessionStorage.getItem('postLoginRedirectUrl') ?? '/dashboard';
    sessionStorage.removeItem('postLoginRedirectUrl');
    this.router.navigateByUrl(redirectUrl, { replaceUrl: true });
  }

  /**
   * Inicia un ping periódico a /auth/session para mantener activa la sesión Redis
   * mientras la pestaña sea visible. Cuando la pestaña se oculta, los pings se detienen.
   * Al volver visible, se envía un ping inmediato y se retoma el intervalo.
   */
  private startSessionKeepalive(): void {
    const visible$ = fromEvent(document, 'visibilitychange');

    merge(of(undefined), visible$)
      .pipe(
        switchMap(() => {
          if (document.visibilityState !== 'visible') return EMPTY;
          return timer(0, AuthService.SESSION_KEEPALIVE_INTERVAL_MS);
        }),
        switchMap(() => {
          if (!this._isAuthenticated()) return EMPTY;
          return this.pingSession();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private pingSession(): Observable<void> {
    return this.http
      .get<AuthSessionResponse>(`${this.apiUrl}/auth/session`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.serviceHealth.markGatewayUp();
            this._isAuthenticated.set(false);
            this._session.set(null);
            this._user.set(null);
          } else if (error.status === 0 || error.status >= 500) {
            this.serviceHealth.markGatewayDown();
          }
          return EMPTY;
        }),
        switchMap(() => EMPTY),
      );
  }

  /**
   * Obtiene el usuario autenticado desde el backend y lo almacena en el signal
   * para exponerlo reactivamente.
   *
   * @returns Una promesa que se resuelve cuando la operación finaliza.
   */
  private fetchAndStoreCurrentAuthenticatedUser(): Promise<void> {
    return new Promise((resolve) => {
      const id = this.userId();
      if (!id) {
        console.warn('User ID not found in session');
        this._user.set(null);
        resolve();
        return;
      }

      this.userService.getById(id).subscribe({
        next: (user) => {
          this._user.set(user);
          resolve();
        },
        error: (err) => {
          console.error('Failed to fetch current user', err);
          this._user.set(null);
          resolve();
        },
      });
    });
  }
}
