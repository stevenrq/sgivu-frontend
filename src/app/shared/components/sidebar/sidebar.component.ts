import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
  ChangeDetectionStrategy,
  EventEmitter,
  Output,
} from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Componente de barra de navegación lateral (sidebar) con soporte responsive.
 * En mobile se comporta como un panel deslizable; en desktop puede colapsarse
 * a modo icónico. El estado de colapso en desktop se persiste en `localStorage`.
 *
 * Emite `sidebarCollapsedChange` para que el layout padre ajuste el contenido principal.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  host: {
    '(window:resize)': 'onWindowResize()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly desktopBreakpoint = 992;
  private readonly desktopCollapsedStorageKey = 'sgivu.sidebar.collapsed.v1';

  /** `true` cuando el viewport está por debajo del breakpoint de desktop (992px). */
  readonly isMobileView = signal(false);
  /** `true` cuando el panel mobile está visible. */
  readonly isSidebarOpen = signal(true);
  /** `true` cuando el sidebar de desktop está en modo icónico (colapsado). */
  readonly isDesktopCollapsed = signal(false);

  /** Emite el estado de colapso del sidebar desktop cuando cambia. */
  @Output() sidebarCollapsedChange = new EventEmitter<boolean>();

  ngOnInit(): void {
    this.isDesktopCollapsed.set(this.loadDesktopCollapsedPreference());
    this.updateResponsiveState();
  }

  /** Actualiza el estado responsive al cambiar el tamaño de la ventana. */
  onWindowResize(): void {
    this.updateResponsiveState();
  }

  /**
   * Alterna la visibilidad del panel mobile.
   * No tiene efecto en desktop.
   */
  toggleSidebar(): void {
    if (!this.isMobileView()) {
      return;
    }
    this.isSidebarOpen.update((open) => !open);
  }

  /**
   * Alterna el sidebar de desktop entre expandido e icónico.
   * Persiste la preferencia en `localStorage` y emite `sidebarCollapsedChange`.
   * No tiene efecto en mobile.
   */
  toggleDesktopSidebar(): void {
    if (this.isMobileView()) {
      return;
    }

    this.isDesktopCollapsed.update((collapsed) => !collapsed);
    const collapsed = this.isDesktopCollapsed();
    this.persistDesktopCollapsedPreference(collapsed);
    this.sidebarCollapsedChange.emit(collapsed);
  }

  /**
   * Cierra el panel mobile si está abierto.
   * No tiene efecto en desktop.
   */
  closeSidebar(): void {
    if (!this.isMobileView()) {
      return;
    }
    this.isSidebarOpen.set(false);
  }

  /** Cierra el panel mobile al navegar a un enlace. Invocado desde el template. */
  handleNavigation(): void {
    this.closeSidebar();
  }

  private updateResponsiveState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isMobileView.set(false);
      this.isSidebarOpen.set(true);
      this.sidebarCollapsedChange.emit(false);
      return;
    }

    const wasMobileView = this.isMobileView();
    const mobileView = window.innerWidth < this.desktopBreakpoint;
    this.isMobileView.set(mobileView);

    if (mobileView) {
      if (!wasMobileView) {
        this.isSidebarOpen.set(false);
      }
      this.sidebarCollapsedChange.emit(false);
    } else {
      this.isSidebarOpen.set(true);
      if (wasMobileView) {
        this.isDesktopCollapsed.set(this.loadDesktopCollapsedPreference());
      }
      this.sidebarCollapsedChange.emit(this.isDesktopCollapsed());
    }
  }

  private loadDesktopCollapsedPreference(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return localStorage.getItem(this.desktopCollapsedStorageKey) === 'true';
  }

  private persistDesktopCollapsedPreference(collapsed: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.desktopCollapsedStorageKey, String(collapsed));
  }
}
