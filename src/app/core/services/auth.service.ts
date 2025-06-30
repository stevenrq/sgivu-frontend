import { Injectable } from '@angular/core';
import {
  OAuthErrorEvent,
  OAuthInfoEvent,
  OAuthService,
  OAuthSuccessEvent,
} from 'angular-oauth2-oidc';
import { authCodeFlowConfig } from '../auth-config';
import { BehaviorSubject, combineLatest, filter, map, Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly isAuthenticatedSubject$ = new BehaviorSubject(false);

  private readonly isDoneLoadingSubject$ = new BehaviorSubject(false);

  public isAuthenticated$ = this.isAuthenticatedSubject$.asObservable();

  public isDoneLoading$ = this.isDoneLoadingSubject$.asObservable();

  constructor(
    private readonly oauthService: OAuthService,
    private readonly router: Router,
  ) {
    this.oauthService.configure(authCodeFlowConfig);
    this.setupOAuthEventListeners();
    this.isAuthenticatedSubject$.next(this.hasValidToken());
  }

  public canActivateProtectedRoutes$: Observable<boolean> = combineLatest<
    [boolean, boolean]
  >([this.isAuthenticated$, this.isDoneLoading$]).pipe(
    map((values) => values.every((value) => value)),
  );

  /**
   * Initializes OAuth flow by attempting to restore existing session.
   * Called during app startup to check for valid tokens.
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * await this.authService.initLoginFlow();
   * ```
   */
  async initLoginFlow() {
    try {
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();

      if (this.hasValidToken()) {
        this.isAuthenticatedSubject$.next(true);
      }

      this.handlePostLoginRedirect();
      this.oauthService.setupAutomaticSilentRefresh();
    } catch (e) {
      console.error('Error during login flow initialization:', e);
      this.isAuthenticatedSubject$.next(false);
    } finally {
      this.isDoneLoadingSubject$.next(true);
    }
  }

  /**
   * Initiates new OAuth login flow by redirecting to provider.
   * Called when user explicitly wants to log in.
   *
   * @param additionalState - Optional state for post-login navigation
   * @param params - Optional OAuth parameters
   * @returns Promise that resolves when redirect is initiated
   *
   * @example
   * ```typescript
   * await this.authService.login('/dashboard');
   * ```
   */
  async login(additionalState?: string, params?: {}) {
    try {
      await this.oauthService.loadDiscoveryDocument();
      this.oauthService.initCodeFlow(additionalState, params);
    } catch (e) {
      console.error('Error during login:', e);
      this.isAuthenticatedSubject$.next(false);
    } finally {
      this.isDoneLoadingSubject$.next(true);
    }
  }

  handlePostLoginRedirect() {
    if (this.oauthService.state) {
      let stateUrl = this.oauthService.state;

      if (!stateUrl.startsWith('/')) {
        stateUrl = decodeURIComponent(stateUrl);
        console.warn(
          `There was state of ${this.oauthService.state}, so we are sending you to: ${stateUrl}`,
        );
        this.router.navigateByUrl(stateUrl);
      }
    }
  }

  logout() {
    this.oauthService.logOut();
  }

  hasValidToken(): boolean {
    return (
      this.oauthService.hasValidAccessToken() &&
      this.oauthService.hasValidIdToken()
    );
  }

  private setupOAuthEventListeners() {
    this.oauthService.events.subscribe((event) => {
      if (event instanceof OAuthErrorEvent) {
        console.error(event);
      } else if (event instanceof OAuthInfoEvent) {
        console.log(event);
      } else if (event instanceof OAuthSuccessEvent) {
        console.log(event);
      } else {
        console.warn('Unhandled OAuth event:', event);
      }
    });

    this.oauthService.events
      .pipe(filter((e) => ['token_received'].includes(e.type)))
      .subscribe(() => this.oauthService.loadUserProfile());

    this.oauthService.events
      .pipe(
        filter((e) => ['session_terminated', 'session_error'].includes(e.type)),
      )
      .subscribe(() => this.login());
  }

  get sub() {
    const claims = this.oauthService.getIdentityClaims();
    return claims ? claims['sub'] : null;
  }
}
