import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ServiceStatusBannerComponent } from './shared/components/service-status-banner/service-status-banner.component';
import { ServiceUnavailableComponent } from './shared/components/service-unavailable/service-unavailable.component';
import { AuthService } from './features/auth/services/auth.service';
import { ServiceHealthService } from './shared/services/service-health.service';

/**
 * Componente raíz de la aplicación.
 * Compone el layout principal: barra de navegación, sidebar colapsable y el `RouterOutlet`
 * donde se renderizan las páginas de cada feature.
 * Propaga el estado de colapso del sidebar al `NavbarComponent` para ajustar márgenes.
 *
 * Cuando el gateway no está disponible y la sesión aún no terminó de hidratarse,
 * sustituye el layout completo por `ServiceUnavailableComponent`. Si la caída ocurre
 * mid-sesión, muestra el banner sticky `ServiceStatusBannerComponent` sin perder
 * el contenido actual.
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NavbarComponent,
    SidebarComponent,
    ServiceStatusBannerComponent,
    ServiceUnavailableComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly serviceHealth = inject(ServiceHealthService);

  readonly isSidebarCollapsed = signal(false);

  /**
   * Muestra la pantalla completa de caída en dos casos:
   *  - Gateway down y la app no logró autenticarse (no se puede operar al arranque).
   *  - Auth down y el usuario aún no tiene sesión (el OAuth flow rebotaría al
   *    auth caído y el navegador saldría de la SPA).
   * Si el usuario ya estaba autenticado, el banner es suficiente porque
   * las APIs de negocio siguen funcionando contra la sesión Redis del gateway.
   */
  readonly showFullOutage = computed(() => {
    const gatewayDown = this.serviceHealth.gatewayStatus() === 'down';
    const authDown = this.serviceHealth.authStatus() === 'down';
    const notAuthenticated = !this.auth.isReadyAndAuthenticated();
    return (gatewayDown || authDown) && notAuthenticated;
  });

  onSidebarCollapsedChange(collapsed: boolean): void {
    this.isSidebarCollapsed.set(collapsed);
  }
}
