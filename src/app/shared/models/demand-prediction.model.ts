/**
 * Métricas de rendimiento del modelo ML de predicción de demanda.
 * Se usan para mostrar la fiabilidad del modelo al usuario y decidir si es necesario reentrenar.
 */
export interface DemandMetrics {
  /** Root Mean Squared Error — error promedio en unidades de demanda. */
  rmse?: number;
  /** Mean Absolute Error — magnitud promedio del error sin penalizar outliers. */
  mae?: number;
  /** Mean Absolute Percentage Error — error relativo; útil para comparar entre segmentos. */
  mape?: number;
  /** Weighted Absolute Percentage Error — robusto a ceros; interpretable como % global de error. */
  wape?: number;
  /** Coeficiente de determinación (0–1). Valores cercanos a 1 indican buen ajuste. */
  r2?: number;
  residual_std?: number;
  /** Métricas de baseline para comparar el modelo contra predictores ingenuos. */
  baselines?: {
    naive_lag1_rmse?: number;
    naive_mean3_rmse?: number;
  };
}

/** Tipo de vehículo para segmentar las predicciones de demanda. */
export type VehicleType = 'CAR' | 'MOTORCYCLE';

/**
 * Parámetros de predicción enviados a la API FastAPI (`/v1/ml/predict-with-history`).
 * `horizonMonths` se acota a [1, 24] y `confidence` a [0.5, 0.99] en el servicio
 * antes de enviar al backend.
 */
export interface DemandPredictionRequest {
  vehicleType: VehicleType;
  brand: string;
  model: string;
  /** Línea del vehículo; si es null el modelo predice para todas las líneas de la marca/modelo. */
  line?: string | null;
  /** Meses a predecir hacia el futuro (default: 6). */
  horizonMonths?: number;
  /** Nivel de confianza para los intervalos (default: 0.95). */
  confidence?: number;
}

/** Punto de predicción de demanda para un mes específico con intervalos de confianza. */
export interface DemandPredictionPoint {
  /** Mes de la predicción en formato `'YYYY-MM'`. */
  month: string;
  /** Demanda prevista (número de unidades). */
  demand: number;
  /** Límite inferior del intervalo de confianza. */
  lowerCi: number;
  /** Límite superior del intervalo de confianza. */
  upperCi: number;
}

/** Punto del histórico de ventas para un mes específico. */
export interface DemandHistoryPoint {
  /** Mes del histórico en formato `'YYYY-MM'`. */
  month: string;
  /** Número de ventas registradas en ese mes. */
  salesCount: number;
}

/**
 * Respuesta de predicción de demanda (ya mapeada a camelCase desde el DTO snake_case del backend).
 * `history` es opcional: solo viene si el modelo tiene datos históricos para el segmento solicitado.
 */
export interface DemandPredictionResponse {
  predictions: DemandPredictionPoint[];
  history?: DemandHistoryPoint[];
  trainedAt?: string;
  modelVersion: string;
  metrics?: DemandMetrics;
  /** Segmento sobre el que se hizo la predicción; mantiene snake_case porque viene directo del backend. */
  segment?: {
    vehicle_type?: string;
    brand?: string;
    model?: string;
    line?: string;
  };
}

/** Metadatos del modelo ML más reciente disponible en el servidor. */
export interface ModelMetadata {
  /** Versión del modelo (e.g., `'v1.2.3'`). */
  version?: string;
  /** Fecha y hora en que fue entrenado (ISO 8601). */
  trainedAt?: string;
  /** Variable objetivo que el modelo predice (e.g., `'demand'`). */
  target?: string;
  /** Lista de características usadas para el entrenamiento. */
  features?: string[];
  /** Métricas de rendimiento del modelo. */
  metrics?: DemandMetrics;
  /** Lista de modelos candidatos evaluados durante el entrenamiento (AutoML). */
  candidates?: Record<string, unknown>[];
}

/**
 * Respuesta del endpoint de reentrenamiento del modelo ML.
 * Mantiene snake_case porque se consume directamente sin mapeo intermedio.
 */
export interface RetrainResponse {
  version: string;
  metrics: DemandMetrics;
  trained_at: string;
  /** Distribución de datos usados para entrenar; permite evaluar si el dataset es suficiente. */
  samples: {
    train: number;
    test: number;
    total: number;
  };
}
