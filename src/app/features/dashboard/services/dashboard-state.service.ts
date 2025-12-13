import { Injectable } from '@angular/core';
import {
  DemandPredictionResponse,
  ModelMetadata,
} from '../../../shared/models/demand-prediction.model';
import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';

export interface SavedPredictionState {
  payload: {
    vehicleType: VehicleKind;
    brand: string;
    model: string;
    line: string | null;
    horizonMonths: number;
    confidence: number;
  };
  response: DemandPredictionResponse;
  activeSegmentLabel: string | null;
  quickVehicleTerm: string;
  latestModel: ModelMetadata | null;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Guarda el último estado de la predicción para que el gráfico permanezca visible
 * al navegar a otras secciones y volver al panel.
 */
export class DashboardStateService {
  private lastPrediction: SavedPredictionState | null = null;
  private readonly storageKey = 'dashboard:lastPrediction';

  setLastPrediction(state: SavedPredictionState): void {
    this.lastPrediction = state;
    this.persistToStorage(state);
  }

  getLastPrediction(): SavedPredictionState | null {
    if (this.lastPrediction) {
      return this.lastPrediction;
    }

    const stored = this.readFromStorage();
    this.lastPrediction = stored;
    return stored;
  }

  clear(): void {
    this.lastPrediction = null;
    this.removeFromStorage();
  }

  private persistToStorage(state: SavedPredictionState): void {
    if (!this.hasStorage()) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // Ignored: localStorage not available or quota exceeded.
    }
  }

  private readFromStorage(): SavedPredictionState | null {
    if (!this.hasStorage()) {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as SavedPredictionState;
    } catch {
      this.removeFromStorage();
      return null;
    }
  }

  private removeFromStorage(): void {
    if (!this.hasStorage()) {
      return;
    }
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore removal errors.
    }
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
