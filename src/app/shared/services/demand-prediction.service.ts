import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DemandPredictionRequest,
  DemandPredictionResponse,
  DemandMetrics,
  ModelMetadata,
  VehicleType,
  RetrainResponse,
} from '../models/demand-prediction.model';

interface PredictionResponseDto {
  predictions: {
    month: string;
    demand: number;
    lower_ci: number;
    upper_ci: number;
  }[];
  history?: {
    month: string;
    sales_count: number;
  }[];
  model_version: string;
  trained_at?: string;
  segment?: {
    vehicle_type?: string;
    brand?: string;
    model?: string;
    line?: string;
  };
  metrics?: DemandMetrics;
}

interface LatestModelDto {
  version?: string;
  trained_at?: string;
  target?: string;
  features?: string[];
  metrics?: DemandMetrics;
  candidates?: Record<string, unknown>[];
}

@Injectable({
  providedIn: 'root',
})
/**
 * Servicio para consumir los endpoints del modelo de demanda (sgivu-ml) vía gateway.
 * Normaliza la carga útil a mayúsculas y mapea las respuestas a DTOs de frontend.
 */
export class DemandPredictionService {
  private readonly apiUrl = `${environment.apiUrl}/v1/ml`;

  constructor(private readonly http: HttpClient) {}

  predict(payload: DemandPredictionRequest): Observable<DemandPredictionResponse> {
    const request = this.buildPayload(payload);
    return this.http
      .post<PredictionResponseDto>(`${this.apiUrl}/predict-with-history`, request)
      .pipe(map((response) => this.mapPredictionResponse(response)));
  }

  getLatestModel(): Observable<ModelMetadata | null> {
    return this.http
      .get<LatestModelDto>(`${this.apiUrl}/models/latest`)
      .pipe(map((dto) => (dto ? this.mapLatestModel(dto) : null)));
  }

  retrain(): Observable<RetrainResponse> {
    return this.http.post<RetrainResponse>(`${this.apiUrl}/retrain`, {});
  }

  private buildPayload(payload: DemandPredictionRequest) {
    const horizon = Math.min(Math.max(payload.horizonMonths ?? 6, 1), 24);
    const confidence = Math.min(Math.max(payload.confidence ?? 0.95, 0.5), 0.99);

    return {
      vehicle_type: this.normalizeVehicleType(payload.vehicleType),
      brand: this.normalizeText(payload.brand),
      model: this.normalizeText(payload.model),
      line: this.normalizeText(payload.line),
      horizon_months: horizon,
      confidence,
    };
  }

  private normalizeText(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    return value.trim().toUpperCase();
  }

  private normalizeVehicleType(value?: VehicleType): VehicleType {
    if (!value) {
      return 'CAR';
    }
    return value.toUpperCase() as VehicleType;
  }

  private mapPredictionResponse(
    response: PredictionResponseDto,
  ): DemandPredictionResponse {
    return {
      predictions:
        response.predictions?.map((item) => ({
          month: item.month,
          demand: item.demand,
          lowerCi: item.lower_ci,
          upperCi: item.upper_ci,
        })) ?? [],
      history:
        response.history?.map((item) => ({
          month: item.month,
          salesCount: item.sales_count,
        })) ?? [],
      modelVersion: response.model_version,
      trainedAt: response.trained_at,
      segment: response.segment,
      metrics: response.metrics,
    };
  }

  private mapLatestModel(dto: LatestModelDto): ModelMetadata {
    return {
      version: dto.version,
      trainedAt: dto.trained_at,
      target: dto.target,
      features: dto.features,
      metrics: dto.metrics,
      candidates: dto.candidates,
    };
  }
}
