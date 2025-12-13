import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  const storageKey = 'sgivu-theme';

  beforeEach(() => {
    // Stub de matchMedia para pruebas de prefers-color-scheme
    (window as any).matchMedia = (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: document },
      ],
    });
    localStorage.clear();
    service = TestBed.inject(ThemeService);
  });

  it('inicializa usando la preferencia almacenada', () => {
    localStorage.setItem(storageKey, 'dark');

    service.initialize();

    expect(service.currentPreference).toBe('dark');
    expect(service.currentTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.classList.contains('theme-dark')).toBeTrue();
  });

  it('alterna entre temas y persiste la preferencia', () => {
    service.setPreference('light');
    const next = service.toggleTheme();

    expect(next).toBe('dark');
    expect(service.currentPreference).toBe('dark');
    expect(localStorage.getItem(storageKey)).toBe('dark');
  });
});
