import { TestBed } from '@angular/core/testing';
import { DashboardStateService, SavedPredictionState } from './dashboard-state.service';
import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';

describe('DashboardStateService', () => {
  let service: DashboardStateService;
  const storageKey = 'dashboard:lastPrediction';

  const sampleState: SavedPredictionState = {
    payload: {
      vehicleType: VehicleKind.CAR,
      brand: 'Toyota',
      model: 'Corolla',
      line: null,
      horizonMonths: 6,
      confidence: 0.95,
    },
    response: {
      predictions: [],
      history: [],
      modelVersion: 'v1',
    },
    activeSegmentLabel: 'Automóvil · Toyota Corolla',
    quickVehicleTerm: 'Toyota',
    latestModel: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DashboardStateService],
    });
    localStorage.clear();
    service = TestBed.inject(DashboardStateService);
  });

  it('persiste y recupera el último estado de predicción', () => {
    service.setLastPrediction(sampleState);

    const stored = localStorage.getItem(storageKey);
    expect(stored).toContain('Toyota');

    const restored = service.getLastPrediction();
    expect(restored).toEqual(sampleState);
  });

  it('borra el estado de memoria y storage', () => {
    service.setLastPrediction(sampleState);
    service.clear();

    expect(service.getLastPrediction()).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
