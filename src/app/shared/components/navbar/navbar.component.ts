import { AsyncPipe, NgClass, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import Collapse from 'bootstrap/js/dist/collapse';
import { AuthService } from '../../../features/auth/services/auth.service';
import { User } from '../../../features/users/models/user.model';
import { UserService } from '../../../features/users/services/user.service';
import { Theme, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, AsyncPipe, NgClass],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, AfterViewInit {
  protected user$!: Observable<User | null>;

  protected isAuthenticated$: Observable<boolean>;
  protected activeTheme$: Observable<Theme>;

  private readonly desktopBreakpoint = 992;
  protected isMobileView = false;
  protected isMenuOpen = false;

  @ViewChild('navbarCollapse')
  private navbarCollapse?: ElementRef<HTMLDivElement>;
  private collapseInstance?: Collapse;

  constructor(
    readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly themeService: ThemeService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.isAuthenticated$ = this.authService.isReadyAndAuthenticated$;
    this.activeTheme$ = this.themeService.activeTheme$;
  }

  ngOnInit(): void {
    this.updateResponsiveState();
    this.user$ = this.authService.currentAuthenticatedUser$.pipe(
      switchMap((authenticatedUser) => {
        if (authenticatedUser?.id) {
          return this.userService.getById(authenticatedUser.id);
        }
        return of(null);
      }),
    );
  }

  ngAfterViewInit(): void {
    this.initializeCollapseInstance();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateResponsiveState();
  }

  login() {
    this.authService.startLoginFlow();
  }

  logout(): void {
    this.authService.logout();
    this.handleNavigation();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMenu(): void {
    if (!this.isMobileView) {
      return;
    }
    if (!this.collapseInstance) {
      this.initializeCollapseInstance();
    }
    if (this.isMenuOpen) {
      this.collapseInstance?.hide();
    } else {
      this.collapseInstance?.show();
    }
  }

  handleNavigation(): void {
    if (!this.isMobileView) {
      return;
    }
    if (!this.collapseInstance) {
      this.initializeCollapseInstance();
    }
    this.collapseInstance?.hide();
  }

  private initializeCollapseInstance(): void {
    if (!this.navbarCollapse || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.collapseInstance = Collapse.getOrCreateInstance(
      this.navbarCollapse.nativeElement,
      {
        toggle: false,
      },
    );

    this.navbarCollapse.nativeElement.addEventListener(
      'shown.bs.collapse',
      () => {
        this.isMenuOpen = true;
      },
    );

    this.navbarCollapse.nativeElement.addEventListener(
      'hidden.bs.collapse',
      () => {
        this.isMenuOpen = false;
      },
    );
  }

  private updateResponsiveState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isMobileView = false;
      return;
    }

    this.isMobileView = window.innerWidth < this.desktopBreakpoint;

    if (!this.isMobileView) {
      this.showDesktopMenu();
      this.isMenuOpen = false;
    } else {
      this.collapseInstance?.hide();
      this.isMenuOpen = false;
    }
  }

  private showDesktopMenu(): void {
    if (this.collapseInstance) {
      this.collapseInstance.show();
      return;
    }

    const element = this.navbarCollapse?.nativeElement;
    if (element && !element.classList.contains('show')) {
      element.classList.add('show');
    }
  }
}
