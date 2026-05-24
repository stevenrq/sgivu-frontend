import {
  DestroyRef,
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  firstValueFrom,
  fromEvent,
  map,
  of,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';

/** Tipos del estado de cada microservicio dependiente del frontend. */
export type ServiceStatus = 'up' | 'down' | 'unknown';

/** Header que evita que el `serviceHealthInterceptor` realimente sus propios chequeos. */
export const SKIP_HEALTH_HEADER = 'X-Skip-Health-Interceptor';

/** Intervalo en milisegundos entre chequeos activos cuando hay degradación. */
const HEALTH_POLL_INTERVAL_MS = 10_000;

/**
 * Intervalo del probe periódico de liveness contra el auth server cuando el
 * usuario ya está autenticado. Permite detectar que `sgivu-auth` se cayó
 * incluso si todas las requests siguen usando solo el gateway (sesión Redis).
 */
const AUTH_LIVENESS_PROBE_INTERVAL_MS = 30_000;

/** Timeout máximo del probe directo al auth server antes de marcarlo como down. */
const AUTH_PROBE_TIMEOUT_MS = 3_000;

/**
 * Servicio centralizado de salud de los microservicios dependientes del frontend
 * (`sgivu-gateway` y `sgivu-auth`). Mantiene el estado reactivo con signals,
 * arranca polling activo cuando se detecta una caída, y notifica con un toast
 * cuando los servicios se recuperan.
 *
 * El polling sólo corre cuando hay degradación y la pestaña está visible, para
 * minimizar tráfico de fondo (mismo patrón que `AuthService.startSessionKeepalive`).
 */
@Injectable({
  providedIn: 'root',
})
export class ServiceHealthService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly apiUrl = environment.apiUrl;
  private readonly authHealthCheckUrl = environment.authHealthCheckUrl;
  private readonly healthHeaders = new HttpHeaders().set(
    SKIP_HEALTH_HEADER,
    '1',
  );
  private livenessSubscription: Subscription | null = null;

  // --- Signals como fuente de verdad ---

  private readonly _gatewayStatus = signal<ServiceStatus>('unknown');
  private readonly _authStatus = signal<ServiceStatus>('unknown');
  private readonly _isChecking = signal(false);
  private previousAnyDown = false;
  private pollingSubscription: Subscription | null = null;

  // --- Signals de solo lectura ---

  public readonly gatewayStatus: Signal<ServiceStatus> =
    this._gatewayStatus.asReadonly();
  public readonly authStatus: Signal<ServiceStatus> =
    this._authStatus.asReadonly();
  public readonly isChecking: Signal<boolean> = this._isChecking.asReadonly();

  public readonly anyServiceDown = computed(
    () => this._gatewayStatus() === 'down' || this._authStatus() === 'down',
  );

  public readonly bothServicesDown = computed(
    () => this._gatewayStatus() === 'down' && this._authStatus() === 'down',
  );

  public readonly intervalSeconds = HEALTH_POLL_INTERVAL_MS / 1000;

  constructor() {
    // Arranca o detiene el polling automáticamente según el estado.
    effect(() => {
      const anyDown = this.anyServiceDown();
      if (anyDown && !this.pollingSubscription) {
        this.startHealthPolling(true);
      } else if (!anyDown && this.pollingSubscription) {
        this.stopHealthPolling();
      }
      // Notificación de recuperación cuando pasamos de down → up.
      if (this.previousAnyDown && !anyDown) {
        this.toast.success('Conexión restablecida');
      }
      this.previousAnyDown = anyDown;
    });
  }

  /** Marca el gateway como caído. No-op si ya estaba `'down'`. */
  public markGatewayDown(): void {
    if (this._gatewayStatus() !== 'down') {
      this._gatewayStatus.set('down');
    }
  }

  /** Marca el gateway como disponible. */
  public markGatewayUp(): void {
    if (this._gatewayStatus() !== 'up') {
      this._gatewayStatus.set('up');
    }
  }

  /** Marca el auth como caído. */
  public markAuthDown(): void {
    if (this._authStatus() !== 'down') {
      this._authStatus.set('down');
    }
  }

  /** Marca el auth como disponible. */
  public markAuthUp(): void {
    if (this._authStatus() !== 'up') {
      this._authStatus.set('up');
    }
  }

  /**
   * Consulta `/actuator/health` del gateway. Cualquier respuesta 2xx se considera UP;
   * errores de red o `5xx` se consideran DOWN. Actualiza el estado de forma reactiva.
   *
   * @returns Observable<boolean> que emite `true` si el gateway responde correctamente.
   */
  public checkGatewayHealth(): Observable<boolean> {
    return this.http
      .get<{ status?: string }>(`${this.apiUrl}/actuator/health`, {
        headers: this.healthHeaders,
        withCredentials: false,
      })
      .pipe(
        map((body) => body?.status !== 'DOWN'),
        tap((isUp) => (isUp ? this.markGatewayUp() : this.markGatewayDown())),
        catchError((error: HttpErrorResponse) => {
          // Un 401/403 igualmente indica que el gateway está respondiendo HTTP.
          if (error.status >= 400 && error.status < 500) {
            this.markGatewayUp();
            return of(true);
          }
          this.markGatewayDown();
          return of(false);
        }),
      );
  }

  /**
   * Probe directo contra el authorization server usando `fetch` con `mode: 'cors'`.
   * Usa `environment.authHealthCheckUrl` — la URL browser-accesible del auth server
   * (el puerto expuesto por Docker, no el hostname interno del contenedor), para que
   * la caída del contenedor se traduzca en un error de red real desde el navegador.
   *
   * A diferencia del modo `no-cors` (respuesta opaca), lee el cuerpo JSON de la
   * respuesta para verificar el estado real del actuator:
   *  - `{status: "UP"}` ⇒ UP.
   *  - `{status: "DOWN"}` o cualquier respuesta no-OK ⇒ DOWN.
   *  - Error de red / timeout ⇒ DOWN.
   *
   * Indispensable para detectar `sgivu-auth` caído cuando el gateway aún
   * responde con sesión Redis (los chequeos vía `/auth/session` no lo notarían).
   *
   * @returns Promise<boolean> que resuelve a `true` si el auth server está sano.
   */
  public async checkAuthHealthDirect(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AUTH_PROBE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(
        `${this.authHealthCheckUrl}/actuator/health`,
        {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        },
      );
      const body = await response.json().catch(() => null);
      // body === null significa que el endpoint devolvió HTML (p.ej. redirect a /login en imágenes
      // anteriores sin permitAll). En ese caso el servidor SÍ responde → UP.
      // Cualquier status distinto a "UP" (STARTING, OUT_OF_SERVICE, DOWN) indica no listo.
      const isUp = response.ok && (body === null || body?.status === 'UP');
      if (isUp) {
        this.markAuthUp();
      } else {
        this.markAuthDown();
      }
      return isUp;
    } catch {
      this.markAuthDown();
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Infiere el estado de `sgivu-auth` consultando `/auth/session` a través del gateway.
   * `2xx` o `401` ⇒ auth responde (UP). `5xx` ⇒ auth no disponible (DOWN).
   *
   * @returns Observable<boolean> que emite `true` si auth está disponible.
   */
  public checkAuthHealth(): Observable<boolean> {
    return this.http
      .get(`${this.apiUrl}/auth/session`, {
        headers: this.healthHeaders,
        withCredentials: true,
      })
      .pipe(
        tap(() => this.markAuthUp()),
        map(() => true),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.markAuthUp();
            return of(true);
          }
          if (error.status === 0 || error.status >= 500) {
            this.markAuthDown();
            return of(false);
          }
          return of(true);
        }),
      );
  }

  /**
   * Dispara un chequeo inmediato de ambos servicios (botón "Reintentar ahora").
   * Combina el chequeo del gateway con el probe directo al auth server.
   */
  public async retryNow(): Promise<void> {
    this._isChecking.set(true);
    try {
      await Promise.all([
        firstValueFrom(this.checkGatewayHealth()),
        this.checkAuthHealthDirect(),
      ]);
    } finally {
      this._isChecking.set(false);
    }
  }

  /**
   * Arranca/detiene un probe periódico directo al auth server según el predicado
   * (típicamente `() => authService.isAuthenticated()`). Indispensable para
   * detectar que `sgivu-auth` se cayó mientras la sesión Redis del gateway sigue
   * vigente: en ese caso ningún request HTTP de negocio fallaría hasta que el
   * usuario intentara hacer logout o el token expirara.
   */
  public startAuthLivenessProbe(shouldProbe: () => boolean): void {
    if (this.livenessSubscription) return;

    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
    );

    this.livenessSubscription = visible$
      .pipe(
        switchMap(() => {
          if (document.visibilityState !== 'visible') return EMPTY;
          return timer(0, AUTH_LIVENESS_PROBE_INTERVAL_MS);
        }),
        switchMap(async () => {
          if (!shouldProbe()) return undefined;
          await this.checkAuthHealthDirect();
          return undefined;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Arranca el polling reactivo a `/actuator/health` mientras la pestaña sea visible.
   * Cuando se oculta la pestaña los pings se detienen; al volver visible se retoman.
   */
  private startHealthPolling(skipInitialTick = false): void {
    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map((_, index) => index),
    );

    this.pollingSubscription = visible$
      .pipe(
        switchMap((emissionIndex) => {
          if (document.visibilityState !== 'visible') return EMPTY;
          // Al arrancar el polling por primera vez, `initializeAuthentication` ya disparó
          // los chequeos iniciales. Retrasamos el primer tick para evitar una doble
          // verificación redundante y alinear el countdown del usuario con el intervalo real.
          // Cuando la pestaña vuelve a ser visible (emissionIndex > 0), sí chequeamos de
          // inmediato para detectar recuperaciones lo antes posible.
          const initialDelay =
            skipInitialTick && emissionIndex === 0
              ? HEALTH_POLL_INTERVAL_MS
              : 0;
          return timer(initialDelay, HEALTH_POLL_INTERVAL_MS);
        }),
        switchMap(async () => {
          await Promise.all([
            firstValueFrom(this.checkGatewayHealth()),
            this.checkAuthHealthDirect(),
          ]);
          return undefined;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private stopHealthPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  /**
   * Reset usado en tests para limpiar el estado entre casos.
   * @internal
   */
  public _resetForTesting(): void {
    this._gatewayStatus.set('unknown');
    this._authStatus.set('unknown');
    this.previousAnyDown = false;
    this.stopHealthPolling();
    this.livenessSubscription?.unsubscribe();
    this.livenessSubscription = null;
  }
}
