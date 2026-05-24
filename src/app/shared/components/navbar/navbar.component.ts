import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { of, switchMap } from 'rxjs';
import Collapse from 'bootstrap/js/dist/collapse';
import { AuthService } from '../../../features/auth/services/auth.service';
import { UserService } from '../../../features/users/services/user.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Barra de navegación superior (navbar) de la aplicación.
 * Gestiona el colapso responsive del menú mobile usando Bootstrap Collapse,
 * el toggle de tema claro/oscuro y los flujos de login/logout.
 */
@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  host: {
    '(window:resize)': 'onWindowResize()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, AfterViewInit {
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly user = toSignal(
    toObservable(this.authService.currentAuthenticatedUser).pipe(
      switchMap((authenticatedUser) => {
        if (authenticatedUser?.id) {
          return this.userService.getById(authenticatedUser.id);
        }
        return of(null);
      }),
    ),
    { initialValue: null },
  );

  protected readonly isReadyAndAuthenticated =
    this.authService.isReadyAndAuthenticated;
  protected readonly isDoneLoading = this.authService.isDoneLoading;
  protected readonly activeTheme = this.themeService.activeTheme;

  private readonly desktopBreakpoint = 992;
  protected readonly isMobileView = signal(false);
  protected readonly isMenuOpen = signal(false);

  private readonly navbarCollapse =
    viewChild<ElementRef<HTMLDivElement>>('navbarCollapse');
  private collapseInstance?: Collapse;

  ngOnInit(): void {
    this.updateResponsiveState();
  }

  ngAfterViewInit(): void {
    this.initializeCollapseInstance();
  }

  onWindowResize(): void {
    this.updateResponsiveState();
  }

  /** Inicia el flujo OAuth2 de login delegando al gateway BFF. */
  async login(): Promise<void> {
    await this.authService.startLoginFlow();
  }

  /** Cierra la sesión del usuario y colapsa el menú mobile. */
  async logout(): Promise<void> {
    await this.authService.logout();
    this.handleNavigation();
  }

  /** Alterna entre tema claro y oscuro. */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /** Muestra u oculta el menú mobile usando Bootstrap Collapse. */
  toggleMenu(): void {
    if (this.isMobileView()) {
      if (!this.collapseInstance) {
        this.initializeCollapseInstance();
      }
      if (this.isMenuOpen()) {
        this.collapseInstance?.hide();
      } else {
        this.collapseInstance?.show();
      }
    }
  }

  /** Colapsa el menú mobile al navegar a un enlace. Invocado desde el template. */
  handleNavigation(): void {
    if (this.isMobileView()) {
      if (!this.collapseInstance) {
        this.initializeCollapseInstance();
      }
      this.collapseInstance?.hide();
    }
  }

  private initializeCollapseInstance(): void {
    const collapseRef = this.navbarCollapse();
    if (!collapseRef || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.collapseInstance = Collapse.getOrCreateInstance(
      collapseRef.nativeElement,
      {
        toggle: false,
      },
    );

    collapseRef.nativeElement.addEventListener('shown.bs.collapse', () => {
      this.isMenuOpen.set(true);
    });

    collapseRef.nativeElement.addEventListener('hidden.bs.collapse', () => {
      this.isMenuOpen.set(false);
    });
  }

  private updateResponsiveState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isMobileView.set(false);
      return;
    }

    this.isMobileView.set(window.innerWidth < this.desktopBreakpoint);

    if (this.isMobileView()) {
      this.collapseInstance?.hide();
    } else {
      this.showDesktopMenu();
    }
    this.isMenuOpen.set(false);
  }

  private showDesktopMenu(): void {
    if (this.collapseInstance) {
      this.collapseInstance.show();
      return;
    }

    const element = this.navbarCollapse()?.nativeElement;
    if (element && !element.classList.contains('show')) {
      element.classList.add('show');
    }
  }
}
