import { AsyncPipe, isPlatformBrowser } from '@angular/common';
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

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, AsyncPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, AfterViewInit {
  protected user$!: Observable<User | null>;

  protected isAuthenticated$: Observable<boolean>;

  private readonly desktopBreakpoint = 992;
  protected isMobileView = false;

  @ViewChild('navbarCollapse')
  private navbarCollapse?: ElementRef<HTMLDivElement>;
  private collapseInstance?: Collapse;

  constructor(
    readonly authService: AuthService,
    private readonly userService: UserService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.isAuthenticated$ = this.authService.isReadyAndAuthenticated$;
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
  }

  private updateResponsiveState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isMobileView = false;
      return;
    }

    this.isMobileView = window.innerWidth < this.desktopBreakpoint;

    if (!this.isMobileView) {
      this.collapseInstance?.hide();
    }
  }
}
