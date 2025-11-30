import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/**
 * Servicio centralizado para administrar el tema de la aplicación.
 * Persiste la preferencia en localStorage, sincroniza con el tema del sistema
 * y expone observables para reaccionar a cambios desde la UI.
 */
@Injectable({
  providedIn: 'root',
})
/** Expone el estado del tema activo y operaciones para alternarlo o persistirlo. */
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

  /**
   * Inicializa el servicio cargando la preferencia almacenada, aplicando el
   * tema correspondiente y suscribiéndose a cambios del sistema operativo.
   * Se protege contra llamadas repetidas para evitar efectos secundarios.
   */
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

  /**
   * Alterna entre tema claro y oscuro. Si la preferencia era `system`, se
   * utiliza el tema actualmente aplicado como referencia para decidir el cambio.
   *
   * @returns El tema resultante después del toggle.
   */
  toggleTheme(): Theme {
    this.ensureInitialized();
    const nextTheme: Theme = this.activeThemeSubject.value === 'dark' ? 'light' : 'dark';
    this.setPreference(nextTheme);
    return nextTheme;
  }

  /**
   * Define explícitamente la preferencia de tema y la aplica sobre el DOM.
   * La preferencia se almacena para que persista entre sesiones.
   *
   * @param preference Preferencia elegida (`light`, `dark` o `system`).
   */
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

  /**
   * Resuelve la preferencia en un tema concreto y sincroniza el DOM con él.
   *
   * @param preference Preferencia seleccionada o detectada.
   */
  private applyPreference(preference: ThemePreference): void {
    const resolvedTheme = this.resolveTheme(preference);
    this.activeThemeSubject.next(resolvedTheme);
    this.applyThemeToDom(resolvedTheme);
  }

  /**
   * Ajusta atributos y clases en el elemento raíz para que los estilos
   * globales respondan al tema activo.
   *
   * @param theme Tema a aplicar en el documento.
   */
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

  /**
   * Determina el tema efectivo a partir de la preferencia seleccionada,
   * consultando el `prefers-color-scheme` cuando se usa la opción `system`.
   *
   * @param preference Preferencia solicitada.
   * @returns Tema concreto que debe activarse.
   */
  private resolveTheme(preference: ThemePreference): Theme {
    if (preference === 'system') {
      return this.prefersDark() ? 'dark' : 'light';
    }

    return preference;
  }

  /** Garantiza que el servicio se inicialice antes de ejecutar operaciones. */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Evalúa si el sistema operativo reporta preferencia por modo oscuro.
   * Retorna `false` en entornos server-side para evitar errores de acceso al DOM.
   */
  private prefersDark(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  /**
   * Se suscribe a cambios en la preferencia de color del sistema para
   * re-aplicar automáticamente el tema cuando la opción es `system`.
   */
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

  /**
   * Lee la preferencia almacenada en `localStorage`, validando que sea uno
   * de los valores esperados. Si no existe, retorna `system` por defecto.
   */
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

  /**
   * Persiste la preferencia de tema en `localStorage` para mantenerla entre sesiones.
   *
   * @param preference Preferencia a almacenar.
   */
  private persistPreference(preference: ThemePreference): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, preference);
  }
}
