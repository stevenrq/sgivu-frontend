import { Injectable } from '@angular/core';
import {
  DemandPredictionResponse,
  ModelMetadata,
} from '../../../shared/models/demand-prediction.model';
import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';

/** Estado de la última predicción de demanda para persistencia entre navegaciones. */
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

/**
 * Servicio de persistencia del estado del dashboard de predicciones.
 * Almacena la última predicción en `localStorage` para restaurarla
 * cuando el usuario vuelve al dashboard sin recargar la app.
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardStateService {
  private lastPrediction: SavedPredictionState | null = null;
  private readonly storageKey = 'dashboard:lastPrediction';

  /**
   * Guarda el estado de la última predicción en memoria y en `localStorage`.
   *
   * @param state - Estado a persistir.
   */
  setLastPrediction(state: SavedPredictionState): void {
    this.lastPrediction = state;
    this.persistToStorage(state);
  }

  /**
   * Recupera el estado de la última predicción.
   * Primero busca en memoria; si no hay, intenta leerlo desde `localStorage`.
   *
   * @returns Estado de la última predicción, o `null` si no hay estado guardado.
   */
  getLastPrediction(): SavedPredictionState | null {
    if (this.lastPrediction) {
      return this.lastPrediction;
    }

    const stored = this.readFromStorage();
    this.lastPrediction = stored;
    return stored;
  }

  /** Elimina el estado de la última predicción de memoria y de `localStorage`. */
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
      // Ignorar silenciosamente los errores de almacenamiento (cuota excedida, navegación privada, etc.)
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
      // Ignorar silenciosamente los errores de almacenamiento (cuota excedida, navegación privada, etc.)
    }
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
