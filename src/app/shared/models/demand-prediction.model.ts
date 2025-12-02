export interface DemandMetrics {
  rmse?: number;
  mae?: number;
  mape?: number;
  r2?: number;
  residual_std?: number;
}

export type VehicleType = 'CAR' | 'MOTORCYCLE';

export interface DemandPredictionRequest {
  vehicleType: VehicleType;
  brand: string;
  model: string;
  line?: string | null;
  horizonMonths?: number;
  confidence?: number;
}

export interface DemandPredictionPoint {
  month: string;
  demand: number;
  lowerCi: number;
  upperCi: number;
}

export interface DemandPredictionResponse {
  predictions: DemandPredictionPoint[];
  modelVersion: string;
  metrics?: DemandMetrics;
}

export interface ModelMetadata {
  version?: string;
  trainedAt?: string;
  target?: string;
  features?: string[];
  metrics?: DemandMetrics;
  candidates?: Record<string, unknown>[];
}

export interface RetrainResponse {
  version: string;
  metrics: DemandMetrics;
  trained_at: string;
  samples: {
    train: number;
    test: number;
    total: number;
  };
}
