/**
 * Setup global de tests (Vitest + jsdom).
 *
 * jsdom no implementa `window.matchMedia`; ThemeService lo consume (y sus specs
 * lo espían), por lo que se expone un stub mínimo y configurable.
 */
const matchMediaStub = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: matchMediaStub,
});

// Paridad con Jasmine: los spies se restauran automáticamente al final de cada
// test (Vitest no lo hace por defecto y los contadores se acumularían entre tests).
afterEach(() => {
  vi.restoreAllMocks();
});
