import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ServiceHealthService } from '../../services/service-health.service';

/**
 * Banner persistente que se muestra en la parte superior del layout principal
 * cuando alguno de los microservicios dependientes está caído.
 * Permite continuar usando la app pero deja al usuario al tanto del estado
 * degradado y ofrece un botón de reintento manual.
 */
@Component({
  selector: 'app-service-status-banner',
  templateUrl: './service-status-banner.component.html',
  styleUrl: './service-status-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceStatusBannerComponent {
  protected readonly serviceHealth = inject(ServiceHealthService);

  /**
   * Define la variante visual y textual del banner según qué servicios estén caídos.
   * Sólo se evalúa cuando `anyServiceDown` es `true`, por lo que siempre devuelve
   * un objeto con copy en español.
   */
  protected readonly bannerView = computed(() => {
    const gatewayDown = this.serviceHealth.gatewayStatus() === 'down';
    const authDown = this.serviceHealth.authStatus() === 'down';

    if (gatewayDown && authDown) {
      return {
        cssClass: 'banner-danger',
        icon: 'bi-cloud-slash-fill',
        message:
          'No podemos conectar con el servidor. Algunas acciones no estarán disponibles.',
      };
    }
    if (gatewayDown) {
      return {
        cssClass: 'banner-danger',
        icon: 'bi-cloud-slash-fill',
        message:
          'Estamos teniendo problemas para conectar con el servidor. Reintentando…',
      };
    }
    return {
      cssClass: 'banner-warning',
      icon: 'bi-shield-exclamation',
      message:
        'Hay un problema con el sistema de autenticación. Algunas acciones pueden fallar.',
    };
  });

  protected async onRetryClick(): Promise<void> {
    await this.serviceHealth.retryNow();
  }
}
