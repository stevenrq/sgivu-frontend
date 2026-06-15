import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { ServiceHealthService } from '../../services/service-health.service';

/**
 * Página de pantalla completa que se muestra cuando la app no logra hidratarse
 * al arranque por una caída de `sgivu-gateway` y/o `sgivu-auth`. Adapta el
 * mensaje según qué servicio esté fuera y ofrece un botón de reintento manual,
 * además de un contador regresivo hasta el próximo chequeo automático.
 */
@Component({
  selector: 'app-service-unavailable',
  templateUrl: './service-unavailable.component.html',
  styleUrl: './service-unavailable.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceUnavailableComponent {
  protected readonly serviceHealth = inject(ServiceHealthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _secondsToNextRetry = signal(
    this.serviceHealth.intervalSeconds,
  );
  protected readonly secondsToNextRetry = this._secondsToNextRetry.asReadonly();

  /**
   * Devuelve el contenido textual de la pantalla según el estado de cada servicio.
   * Sólo se evalúa cuando el componente está montado (porque algo está caído).
   */
  protected readonly outageView = computed(() => {
    const gatewayDown = this.serviceHealth.gatewayStatus() === 'down';
    const authDown = this.serviceHealth.authStatus() === 'down';

    if (gatewayDown && authDown) {
      return {
        title: 'Servicio no disponible',
        description:
          'Los sistemas no responden en este momento. Estamos reintentando la conexión automáticamente.',
        icon: 'bi-cloud-slash',
      };
    }
    if (gatewayDown) {
      return {
        title: 'No podemos conectar con el servidor',
        description:
          'El gateway del sistema no responde. Reintentaremos automáticamente; también puedes intentarlo ahora.',
        icon: 'bi-cloud-slash',
      };
    }
    return {
      title: 'Autenticación no disponible',
      description:
        'El sistema de autenticación no está respondiendo. Reintentaremos automáticamente la conexión.',
      icon: 'bi-shield-exclamation',
    };
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const next = this._secondsToNextRetry() - 1;
        this._secondsToNextRetry.set(
          next <= 0 ? this.serviceHealth.intervalSeconds : next,
        );
      });
  }

  protected async onRetryClick(): Promise<void> {
    this._secondsToNextRetry.set(this.serviceHealth.intervalSeconds);
    await this.serviceHealth.retryNow();
  }
}
