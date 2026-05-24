import { TestBed } from '@angular/core/testing';

import {
  DashboardStateService,
  SavedPredictionState,
} from '../services/dashboard-state.service';
import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';

describe('DashboardStateService', () => {
  let service: DashboardStateService;

  const buildState = (): SavedPredictionState => ({
    payload: {
      vehicleType: VehicleKind.CAR,
      brand: 'Ford',
      model: 'Fiesta',
      line: null,
      horizonMonths: 6,
      confidence: 0.9,
    },
    response: {
      predictions: [{ month: '2025-01', demand: 10, lowerCi: 8, upperCi: 12 }],
      modelVersion: 'v1',
    },
    activeSegmentLabel: 'segmento-1',
    quickVehicleTerm: 'Ford Fiesta',
    latestModel: { version: 'v1' },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DashboardStateService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('setLastPrediction()', () => {
    it('Debe establecer la última predicción y persistirla en storage', () => {
      const state = buildState();
      const persistSpy = spyOn(
        service as any,
        'persistToStorage',
      ).and.callThrough();

      service.setLastPrediction(state);

      expect(persistSpy).toHaveBeenCalledWith(state);
      expect(service.getLastPrediction()).toEqual(state);
    });
  });

  describe('getLastPrediction()', () => {
    it('Debe retornar valor en memoria sin leer storage', () => {
      const state = buildState();
      spyOn(service as any, 'readFromStorage').and.callThrough();

      service.setLastPrediction(state);
      const result = service.getLastPrediction();

      expect(result).toEqual(state);
      expect((service as any).readFromStorage).not.toHaveBeenCalled();
    });

    it('Debe leer de storage cuando el valor en memoria está vacío', () => {
      const state = buildState();
      const key = (service as any).storageKey as string;
      localStorage.setItem(key, JSON.stringify(state));

      const result = service.getLastPrediction();

      expect(result).toEqual(state);
    });

    it('Debe mantener en caché el resultado después de leer de storage', () => {
      const state = buildState();
      const key = (service as any).storageKey as string;
      localStorage.setItem(key, JSON.stringify(state));

      const first = service.getLastPrediction();
      localStorage.removeItem(key);
      const second = service.getLastPrediction();

      expect(first).toEqual(state);
      expect(second).toEqual(state);
    });
  });

  describe('clear()', () => {
    it('Debe limpiar valor en memoria y eliminar de storage', () => {
      const state = buildState();
      const removeSpy = spyOn(
        service as any,
        'removeFromStorage',
      ).and.callThrough();

      service.setLastPrediction(state);
      service.clear();

      expect(removeSpy).toHaveBeenCalled();
      expect(service.getLastPrediction()).toBeNull();
    });
  });

  describe('persistToStorage()', () => {
    it('Debe guardar JSON en localStorage cuando está disponible', () => {
      const state = buildState();
      const key = (service as any).storageKey as string;
      const setSpy = spyOn(localStorage, 'setItem').and.callThrough();

      (service as any).persistToStorage(state);

      expect(setSpy).toHaveBeenCalledWith(key, JSON.stringify(state));
    });

    it('Debe no lanzar error si localStorage.setItem falla', () => {
      const state = buildState();
      spyOn(localStorage, 'setItem').and.throwError('fail');

      expect(() => (service as any).persistToStorage(state)).not.toThrow();
    });

    it('Debe no hacer nada cuando localStorage no está disponible', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
      });

      try {
        expect(() =>
          (service as any).persistToStorage(buildState()),
        ).not.toThrow();
      } finally {
        if (original) {
          Object.defineProperty(window, 'localStorage', original);
        }
      }
    });
  });

  describe('readFromStorage()', () => {
    it('Debe retornar null cuando localStorage no está disponible', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
      });

      try {
        expect((service as any).readFromStorage()).toBeNull();
      } finally {
        if (original) {
          Object.defineProperty(window, 'localStorage', original);
        }
      }
    });

    it('Debe retornar null cuando la clave no existe', () => {
      const result = (service as any).readFromStorage();
      expect(result).toBeNull();
    });

    it('Debe retornar valor parseado cuando el JSON es válido', () => {
      const state = buildState();
      const key = (service as any).storageKey as string;
      localStorage.setItem(key, JSON.stringify(state));

      const result = (service as any).readFromStorage();

      expect(result).toEqual(state);
    });

    it('Debe retornar null y eliminar de storage cuando el JSON es inválido', () => {
      const key = (service as any).storageKey as string;
      localStorage.setItem(key, '{bad-json');

      const removeSpy = spyOn(
        service as any,
        'removeFromStorage',
      ).and.callThrough();

      const result = (service as any).readFromStorage();

      expect(result).toBeNull();
      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe('removeFromStorage()', () => {
    it('Debe eliminar clave de localStorage cuando está disponible', () => {
      const key = (service as any).storageKey as string;
      localStorage.setItem(key, 'value');
      const removeSpy = spyOn(localStorage, 'removeItem').and.callThrough();

      (service as any).removeFromStorage();

      expect(removeSpy).toHaveBeenCalledWith(key);
    });

    it('Debe no lanzar error si localStorage.removeItem falla', () => {
      spyOn(localStorage, 'removeItem').and.throwError('fail');

      expect(() => (service as any).removeFromStorage()).not.toThrow();
    });

    it('Debe no hacer nada cuando localStorage no está disponible', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
      });

      try {
        expect(() => (service as any).removeFromStorage()).not.toThrow();
      } finally {
        if (original) {
          Object.defineProperty(window, 'localStorage', original);
        }
      }
    });
  });
});
