import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'sgivu-theme';
  private readonly preferenceSubject = new BehaviorSubject<ThemePreference>('system');
  readonly preference$ = this.preferenceSubject.asObservable();

  private readonly activeThemeSubject = new BehaviorSubject<Theme>('light');
  readonly activeTheme$ = this.activeThemeSubject.asObservable();

  private initialized = false;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const preference = this.loadStoredPreference();
    this.preferenceSubject.next(preference);
    this.applyPreference(preference);
    this.listenToSystemChanges();
  }

  toggleTheme(): Theme {
    this.ensureInitialized();
    const nextTheme: Theme = this.activeThemeSubject.value === 'dark' ? 'light' : 'dark';
    this.setPreference(nextTheme);
    return nextTheme;
  }

  setPreference(preference: ThemePreference): void {
    this.ensureInitialized();
    this.preferenceSubject.next(preference);
    this.persistPreference(preference);
    this.applyPreference(preference);
  }

  get currentPreference(): ThemePreference {
    return this.preferenceSubject.value;
  }

  get currentTheme(): Theme {
    return this.activeThemeSubject.value;
  }

  private applyPreference(preference: ThemePreference): void {
    const resolvedTheme = this.resolveTheme(preference);
    this.activeThemeSubject.next(resolvedTheme);
    this.applyThemeToDom(resolvedTheme);
  }

  private applyThemeToDom(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document?.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute('data-theme', theme);
    this.document.body.classList.toggle('theme-dark', theme === 'dark');
  }

  private resolveTheme(preference: ThemePreference): Theme {
    if (preference === 'system') {
      return this.prefersDark() ? 'dark' : 'light';
    }

    return preference;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private prefersDark(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenToSystemChanges(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemMediaQuery.addEventListener('change', () => {
      if (this.preferenceSubject.value === 'system') {
        this.applyPreference('system');
      }
    });
  }

  private loadStoredPreference(): ThemePreference {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }

    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }

    return 'system';
  }

  private persistPreference(preference: ThemePreference): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, preference);
  }
}
