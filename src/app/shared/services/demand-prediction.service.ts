import { Injectable, inject, signal } from '@angular/core';
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

/**
 * DTO de respuesta de la API FastAPI (snake_case).
 * Existe separada de `DemandPredictionResponse` (camelCase) porque
 * el servicio hace el mapeo explícito en lugar de usar un interceptor global.
 */
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

/** DTO del endpoint `/models/latest` (snake_case). Se mapea a `ModelMetadata`. */
interface LatestModelDto {
  version?: string;
  trained_at?: string;
  target?: string;
  features?: string[];
  metrics?: DemandMetrics;
  candidates?: Record<string, unknown>[];
}

/**
 * Puente entre Angular (camelCase) y la API FastAPI de ML (snake_case).
 * Se encarga de normalizar payloads, acotar parámetros a rangos válidos
 * y transformar las respuestas al modelo de dominio del frontend.
 */
@Injectable({
  providedIn: 'root',
})
export class DemandPredictionService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/ml`;

  readonly retrainLoading = signal(false);
  readonly retrainError = signal<string | null>(null);
  readonly retrainMessage = signal<string | null>(null);
  readonly lastTrainedModel = signal<ModelMetadata | null>(null);

  startRetrain(): void {
    this.retrainError.set(null);
    this.retrainMessage.set(null);

    this.http.post<RetrainResponse>(`${this.apiUrl}/retrain`, {}).subscribe({
      next: (metadata) => {
        this.lastTrainedModel.set({
          version: metadata.version,
          trainedAt: metadata.trained_at,
          metrics: metadata.metrics,
        });
        this.retrainMessage.set('Modelo reentrenado correctamente.');
        this.retrainLoading.set(false);
      },
      error: (error) => {
        const isTimeout = error?.status === 504;
        this.retrainError.set(
          error?.error?.detail ??
            (isTimeout
              ? 'El reentrenamiento superó el tiempo máximo de 30 minutos. El modelo anterior sigue activo. Inténtelo más tarde.'
              : 'No se pudo reentrenar el modelo. Inténtelo nuevamente.'),
        );
        this.retrainLoading.set(false);
      },
    });
  }

  /**
   * Solicita predicciones de demanda con histórico al modelo ML.
   *
   * @param payload - Parámetros de la predicción (tipo de vehículo, horizonte, confianza, etc.).
   * @returns Observable con las predicciones y el histórico mapeados al modelo de dominio.
   */
  predict(
    payload: DemandPredictionRequest,
  ): Observable<DemandPredictionResponse> {
    const request = this.buildPayload(payload);
    return this.http
      .post<PredictionResponseDto>(
        `${this.apiUrl}/predict-with-history`,
        request,
      )
      .pipe(map((response) => this.mapPredictionResponse(response)));
  }

  /**
   * Obtiene los metadatos del modelo ML más reciente entrenado.
   *
   * @returns Observable con los metadatos del modelo, o `null` si no hay modelo disponible.
   */
  getLatestModel(): Observable<ModelMetadata | null> {
    return this.http
      .get<LatestModelDto>(`${this.apiUrl}/models/latest`)
      .pipe(map((dto) => (dto ? this.mapLatestModel(dto) : null)));
  }

  /**
   * Solicita el reentrenamiento del modelo ML con los datos históricos disponibles.
   *
   * @returns Observable con la respuesta del servidor indicando el estado del reentrenamiento.
   */
  retrain(): Observable<RetrainResponse> {
    return this.http.post<RetrainResponse>(`${this.apiUrl}/retrain`, {});
  }

  /**
   * Construye el payload para la API acotando `horizonMonths` a [1, 24] y
   * `confidence` a [0.5, 0.99] para evitar errores de validación en el modelo ML.
   *
   * @param payload - Datos de entrada del usuario para la predicción de demanda.
   * @returns Objeto formateado para la API FastAPI.
   */
  private buildPayload(payload: DemandPredictionRequest) {
    const horizon = Math.min(Math.max(payload.horizonMonths ?? 6, 1), 24);
    const confidence = Math.min(
      Math.max(payload.confidence ?? 0.95, 0.5),
      0.99,
    );

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
