import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockDocument: any;
  let mockDocumentElement: any;
  let mockBody: any;
  let mockMediaQueryList: any;
  let mediaQueryListeners: ((event: MediaQueryListEvent) => void)[] = [];

  beforeEach(() => {
    // Mock localStorage
    let store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    // Mock document.body.classList
    const classList = {
      classes: new Set<string>(),
      toggle: (className: string, force?: boolean) => {
        if (force === undefined) {
          if (classList.classes.has(className)) {
            classList.classes.delete(className);
          } else {
            classList.classes.add(className);
          }
        } else if (force) {
          classList.classes.add(className);
        } else {
          classList.classes.delete(className);
        }
      },
      contains: (className: string) => classList.classes.has(className),
      add: (className: string) => classList.classes.add(className),
      remove: (className: string) => classList.classes.delete(className),
    };

    mockDocumentElement = {
      dataset: {},
    };

    mockBody = {
      classList,
    };

    mockDocument = {
      documentElement: mockDocumentElement,
      body: mockBody,
    };

    // Mock window.matchMedia
    mediaQueryListeners = [];
    mockMediaQueryList = {
      matches: false,
      addEventListener: (
        event: string,
        listener: (e: MediaQueryListEvent) => void,
      ) => {
        if (event === 'change') {
          mediaQueryListeners.push(listener);
        }
      },
      removeEventListener: jasmine.createSpy('removeEventListener'),
    };

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(ThemeService);

    // Mock window.matchMedia
    spyOn(window, 'matchMedia').and.returnValue(mockMediaQueryList as any);

    // Mock localStorage
    spyOn(localStorage, 'getItem').and.callFake(mockLocalStorage.getItem);
    spyOn(localStorage, 'setItem').and.callFake(mockLocalStorage.setItem);
    spyOn(localStorage, 'removeItem').and.callFake(mockLocalStorage.removeItem);
  });

  describe('initialize()', () => {
    it('debe cargar preferencia del localStorage y aplicar tema', () => {
      localStorage.setItem('sgivu-theme', 'dark');
      service['initialized'] = false;

      service.initialize();

      expect(localStorage.getItem).toHaveBeenCalledWith('sgivu-theme');
      expect(service.currentPreference).toBe('dark');
      expect(mockDocumentElement.dataset['theme']).toBe('dark');
    });

    it('debe ser idempotente y no reinicializarse si ya está inicializado', () => {
      service.initialize();
      const firstInitialized = service['initialized'];

      service.initialize();

      expect(firstInitialized).toBe(true);
      expect(service['initialized']).toBe(true);
    });

    it('debe actualizar señal de preferencia al inicializar', () => {
      localStorage.setItem('sgivu-theme', 'light');
      service['initialized'] = false;

      service.initialize();

      expect(service.currentPreference).toBe('light');
    });

    it('debe actualizar señal de tema activo al inicializar', () => {
      localStorage.setItem('sgivu-theme', 'dark');
      service['initialized'] = false;

      service.initialize();

      expect(service.currentTheme).toBe('dark');
    });

    it('debe escuchar cambios del sistema cuando se inicializa', () => {
      service.initialize();

      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)',
      );
    });
  });

  describe('toggleTheme()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('debe alternar de light a dark', () => {
      service.setPreference('light');

      const result = service.toggleTheme();

      expect(result).toBe('dark');
      expect(service.currentTheme).toBe('dark');
      expect(mockDocumentElement.dataset['theme']).toBe('dark');
    });

    it('debe alternar de dark a light', () => {
      service.setPreference('dark');

      const result = service.toggleTheme();

      expect(result).toBe('light');
      expect(service.currentTheme).toBe('light');
      expect(mockDocumentElement.dataset['theme']).toBe('light');
    });

    it('debe persistir preferencia y actualizar señal de tema activo', () => {
      service.setPreference('light');

      service.toggleTheme();

      expect(service.currentTheme).toBe('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('sgivu-theme', 'dark');
    });
  });

  describe('setPreference()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('debe establecer light y aplicar tema light', () => {
      service.setPreference('light');

      expect(service.currentPreference).toBe('light');
      expect(service.currentTheme).toBe('light');
      expect(mockDocumentElement.dataset['theme']).toBe('light');
      expect(mockBody.classList.contains('theme-dark')).toBe(false);
    });

    it('debe establecer dark y aplicar tema dark', () => {
      service.setPreference('dark');

      expect(service.currentPreference).toBe('dark');
      expect(service.currentTheme).toBe('dark');
      expect(mockDocumentElement.dataset['theme']).toBe('dark');
      expect(mockBody.classList.contains('theme-dark')).toBe(true);
    });

    it('debe establecer system y resolver según el sistema operativo', () => {
      mockMediaQueryList.matches = true; // Sistema operativo prefiere dark

      service.setPreference('system');

      expect(service.currentPreference).toBe('system');
      expect(service.currentTheme).toBe('dark');
    });

    it('debe persistir en localStorage y actualizar señal de preferencia', () => {
      service.setPreference('dark');

      expect(service.currentPreference).toBe('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('sgivu-theme', 'dark');
    });
  });

  describe('applyThemeToDom()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('debe aplicar data-theme al documentElement', () => {
      service.setPreference('dark');

      expect(mockDocumentElement.dataset['theme']).toBe('dark');

      service.setPreference('light');

      expect(mockDocumentElement.dataset['theme']).toBe('light');
    });

    it('debe agregar clase theme-dark cuando tema es dark', () => {
      service.setPreference('dark');

      expect(mockBody.classList.contains('theme-dark')).toBe(true);
    });

    it('debe remover clase theme-dark cuando tema es light', () => {
      service.setPreference('dark');
      expect(mockBody.classList.contains('theme-dark')).toBe(true);

      service.setPreference('light');

      expect(mockBody.classList.contains('theme-dark')).toBe(false);
    });
  });

  describe('listenToSystemChanges()', () => {
    it('debe reaccionar a cambios del sistema cuando preferencia es system', () => {
      service.initialize();
      service.setPreference('system');
      mockMediaQueryList.matches = false; // Light en inicio

      expect(service.currentTheme).toBe('light');

      // Simular cambio del sistema a dark
      mockMediaQueryList.matches = true;
      mediaQueryListeners[0](new Event('change') as any);

      expect(service.currentTheme).toBe('dark');
    });

    it('no debe reaccionar si preferencia no es system', () => {
      service.initialize();
      service.setPreference('light');
      mockMediaQueryList.matches = false;

      // Simular cambio del sistema a dark
      mockMediaQueryList.matches = true;
      mediaQueryListeners[0](new Event('change') as any);

      // Debe mantener light porque la preferencia no es 'system'
      expect(service.currentTheme).toBe('light');
    });

    it('debe configurar listener en window.matchMedia', () => {
      service.initialize();

      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)',
      );
      expect(mediaQueryListeners.length).toBeGreaterThan(0);
    });
  });

  describe('currentPreference getter', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('debe retornar preferencia actual', () => {
      service.setPreference('dark');

      expect(service.currentPreference).toBe('dark');
    });

    it('debe actualizarse después de cambios', () => {
      expect(service.currentPreference).toBe('system');

      service.setPreference('light');

      expect(service.currentPreference).toBe('light');
    });
  });

  describe('currentTheme getter', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('debe retornar tema actual', () => {
      service.setPreference('dark');

      expect(service.currentTheme).toBe('dark');
    });

    it('debe actualizarse después de cambios', () => {
      expect(service.currentTheme).toBe('light'); // system default light

      service.setPreference('dark');

      expect(service.currentTheme).toBe('dark');
    });
  });

  describe('localStorage & signals', () => {
    it('debe guardar preferencia en localStorage', () => {
      service.initialize();
      service.setPreference('dark');

      expect(localStorage.setItem).toHaveBeenCalledWith('sgivu-theme', 'dark');
    });

    it('debe cargar preferencia del localStorage al inicializar', () => {
      localStorage.setItem('sgivu-theme', 'dark');
      service['initialized'] = false;

      service.initialize();

      expect(service.currentPreference).toBe('dark');
    });

    it('debe defecto a system si valor en localStorage es inválido', () => {
      localStorage.setItem('sgivu-theme', 'invalid-value');
      service['initialized'] = false;

      service.initialize();

      expect(service.currentPreference).toBe('system');
    });

    it('debe actualizar señales correctamente con cambios sucesivos', () => {
      service.initialize();
      service.setPreference('dark');

      expect(service.currentPreference).toBe('dark');
      expect(service.currentTheme).toBe('dark');

      service.setPreference('light');

      expect(service.currentPreference).toBe('light');
      expect(service.currentTheme).toBe('light');
    });
  });

  describe('SSR handling', () => {
    it('debe manejar correctamente cuando no es browser platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ThemeService,
          { provide: DOCUMENT, useValue: mockDocument },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const ssrService = TestBed.inject(ThemeService);

      ssrService.initialize();

      // En SSR, no debe aplicar temas al DOM
      expect(mockDocumentElement.dataset['theme']).toBeUndefined();
    });

    it('debe retornar light por defecto en SSR al cargar desde localStorage', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ThemeService,
          { provide: DOCUMENT, useValue: mockDocument },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const ssrService = TestBed.inject(ThemeService);

      ssrService.initialize();

      expect(ssrService.currentPreference).toBe('light');
    });
  });
});
