import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, Signal, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/**
 * Servicio de gestión de temas visuales (claro/oscuro/sistema).
 * Persiste la preferencia del usuario en `localStorage` y escucha
 * los cambios del sistema cuando la preferencia es `'system'`.
 * Aplica el tema activo al DOM mediante `data-theme` y la clase `theme-dark`.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject<Document>(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'sgivu-theme';

  // --- Signals como fuente de verdad ---

  private readonly _preference = signal<ThemePreference>('system');
  private readonly _activeTheme = signal<Theme>('light');

  // --- Signals de solo lectura ---

  public readonly preference: Signal<ThemePreference> =
    this._preference.asReadonly();

  public readonly activeTheme: Signal<Theme> = this._activeTheme.asReadonly();

  private initialized = false;

  /**
   * Inicializa el servicio: carga la preferencia almacenada, aplica el tema al DOM
   * y registra el listener de cambios del sistema. Es idempotente: solo se ejecuta una vez.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const preference = this.loadStoredPreference();
    this._preference.set(preference);
    this.applyPreference(preference);
    this.listenToSystemChanges();
  }

  /**
   * Alterna entre tema claro y oscuro (ignora `'system'`).
   *
   * @returns El tema activo resultante después del toggle.
   */
  toggleTheme(): Theme {
    this.ensureInitialized();
    const nextTheme: Theme = this._activeTheme() === 'dark' ? 'light' : 'dark';
    this.setPreference(nextTheme);
    return nextTheme;
  }

  /**
   * Establece la preferencia de tema, la persiste en `localStorage` y aplica el cambio al DOM.
   *
   * @param preference - Preferencia de tema: `'light'`, `'dark'` o `'system'`.
   */
  setPreference(preference: ThemePreference): void {
    this.ensureInitialized();
    this._preference.set(preference);
    this.persistPreference(preference);
    this.applyPreference(preference);
  }

  /** Preferencia actual del usuario: `'light'`, `'dark'` o `'system'`. */
  get currentPreference(): ThemePreference {
    return this._preference();
  }

  /** Tema activo resuelto en el DOM: `'light'` o `'dark'`. */
  get currentTheme(): Theme {
    return this._activeTheme();
  }

  private applyPreference(preference: ThemePreference): void {
    const resolvedTheme = this.resolveTheme(preference);
    this._activeTheme.set(resolvedTheme);
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

    root.dataset['theme'] = theme;
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
      if (this._preference() === 'system') {
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
