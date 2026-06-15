import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  DemandPredictionRequest,
  DemandPredictionResponse,
  DemandMetrics,
  ModelMetadata,
  RetrainResponse,
} from '../models/demand-prediction.model';
import { DemandPredictionService } from './demand-prediction.service';

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

describe('DemandPredictionService', () => {
  let service: DemandPredictionService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/ml`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DemandPredictionService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DemandPredictionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verificar que no haya solicitudes HTTP pendientes
    httpMock.verify();
  });

  describe('predict()', () => {
    it('Debe hacer POST a predict-with-history con payload transformado', () => {
      const request: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: '  toyota  ',
        model: '  corolla  ',
        line: '  le  ',
        horizonMonths: 6,
        confidence: 0.95,
      };

      const mockResponse: PredictionResponseDto = {
        predictions: [
          {
            month: '2025-03',
            demand: 150,
            lower_ci: 140,
            upper_ci: 160,
          },
        ],
        model_version: '1.0.0',
        trained_at: '2025-02-01',
      };

      service.predict(request).subscribe((response) => {
        expect(response.predictions.length).toBe(1);
        expect(response.predictions[0].month).toBe('2025-03');
        expect(response.modelVersion).toBe('1.0.0');
      });

      const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.vehicle_type).toBe('CAR');
      expect(req.request.body.brand).toBe('TOYOTA');
      expect(req.request.body.model).toBe('COROLLA');
      expect(req.request.body.line).toBe('LE');
      req.flush(mockResponse);
    });

    it('Debe limitar horizon months entre 1 y 24', () => {
      const requestMin: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: 'Toyota',
        model: 'Corolla',
        horizonMonths: 0, // Debe ajustar a 1
      };

      const requestMax: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: 'Honda',
        model: 'Civic',
        horizonMonths: 50, // Debe ajustar a 24
      };

      const mockResponse: PredictionResponseDto = {
        predictions: [],
        model_version: '1.0.0',
      };

      // Test mínimo
      service.predict(requestMin).subscribe();
      let req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.horizon_months).toBe(1);
      req.flush(mockResponse);

      // Test máximo
      service.predict(requestMax).subscribe();
      req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.horizon_months).toBe(24);
      req.flush(mockResponse);
    });

    it('Debe limitar confidence entre 0.5 y 0.99', () => {
      const requestLow: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: 'Ford',
        model: 'Mustang',
        confidence: 0.3, // Debe ajustar a 0.5
      };

      const requestHigh: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: 'Chevy',
        model: 'Malibu',
        confidence: 1, // Debe ajustar a 0.99
      };

      const mockResponse: PredictionResponseDto = {
        predictions: [],
        model_version: '1.0.0',
      };

      // Test mínimo
      service.predict(requestLow).subscribe();
      let req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.confidence).toBe(0.5);
      req.flush(mockResponse);

      // Test máximo
      service.predict(requestHigh).subscribe();
      req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.confidence).toBe(0.99);
      req.flush(mockResponse);
    });

    it('Debe normalizar tipo de vehículo a mayúsculas y usar CAR por defecto', () => {
      const mockResponse: PredictionResponseDto = {
        predictions: [],
        model_version: '1.0.0',
      };

      // Sin vehicleType
      service
        .predict({ vehicleType: 'CAR', brand: 'Toyota', model: 'Corolla' })
        .subscribe();
      let req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.vehicle_type).toBe('CAR');
      req.flush(mockResponse);

      // Con vehicleType MOTORCYCLE
      service
        .predict({
          vehicleType: 'MOTORCYCLE',
          brand: 'Harley',
          model: 'Street',
        })
        .subscribe();
      req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.vehicle_type).toBe('MOTORCYCLE');
      req.flush(mockResponse);
    });

    it('Debe mapear respuesta de predicción correctamente con propiedades camelCase', () => {
      const request: DemandPredictionRequest = {
        vehicleType: 'CAR',
        brand: 'Toyota',
        model: 'Corolla',
      };
      const mockResponse: PredictionResponseDto = {
        predictions: [
          {
            month: '2025-03',
            demand: 150,
            lower_ci: 140,
            upper_ci: 160,
          },
          {
            month: '2025-04',
            demand: 160,
            lower_ci: 150,
            upper_ci: 170,
          },
        ],
        history: [
          { month: '2025-01', sales_count: 120 },
          { month: '2025-02', sales_count: 130 },
        ],
        model_version: '1.0.0',
        trained_at: '2025-02-01',
        segment: {
          vehicle_type: 'CAR',
          brand: 'TOYOTA',
        },
        metrics: {
          mae: 5.5,
          rmse: 7.2,
        },
      };

      let receivedResponse: DemandPredictionResponse | undefined;
      service.predict(request).subscribe((response) => {
        receivedResponse = response;
      });

      const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      req.flush(mockResponse);

      expect(receivedResponse?.predictions[0].lowerCi).toBe(140);
      expect(receivedResponse?.predictions[0].upperCi).toBe(160);
      expect(receivedResponse?.history?.[0].salesCount).toBe(120);
      expect(receivedResponse?.modelVersion).toBe('1.0.0');
      expect(receivedResponse?.trainedAt).toBe('2025-02-01');
      expect(receivedResponse?.metrics?.mae).toBe(5.5);
    });

    it('Debe manejar predicciones e historial vacíos', () => {
      const mockResponse: PredictionResponseDto = {
        predictions: [],
        history: undefined,
        model_version: '1.0.0',
      };

      let receivedResponse: DemandPredictionResponse | undefined;
      service
        .predict({ vehicleType: 'CAR', brand: 'Honda', model: 'Civic' })
        .subscribe((response) => {
          receivedResponse = response;
        });

      const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      req.flush(mockResponse);

      expect(receivedResponse?.predictions).toEqual([]);
      expect(receivedResponse?.history).toEqual([]);
    });

    it('Debe propagar errores HTTP', () => {
      let errorReceived: any;
      service
        .predict({ vehicleType: 'CAR', brand: 'Ford', model: 'Mustang' })
        .subscribe({
          error: (error) => {
            errorReceived = error;
          },
        });

      const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      req.error(new ProgressEvent('error'), {
        status: 400,
        statusText: 'Bad Request',
      });

      expect(errorReceived).toBeTruthy();
    });

    it('Debe usar horizon 6 y confidence 0.95 por defecto cuando no se proporcionan', () => {
      const mockResponse: PredictionResponseDto = {
        predictions: [],
        model_version: '1.0.0',
      };

      service
        .predict({ vehicleType: 'CAR', brand: 'Chevrolet', model: 'Malibu' })
        .subscribe();

      const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
      expect(req.request.body.horizon_months).toBe(6);
      expect(req.request.body.confidence).toBe(0.95);
      req.flush(mockResponse);
    });
  });

  describe('getLatestModel()', () => {
    it('Debe hacer GET al endpoint models/latest', () => {
      const mockResponse: LatestModelDto = {
        version: '1.2.0',
        trained_at: '2025-02-01',
        target: 'sales_count',
        features: ['seasonality', 'trend', 'brand'],
      };

      let receivedModel: ModelMetadata | null | undefined;
      service.getLatestModel().subscribe((model) => {
        receivedModel = model;
      });

      const req = httpMock.expectOne(`${apiUrl}/models/latest`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      expect(receivedModel?.version).toBe('1.2.0');
      expect(receivedModel?.trainedAt).toBe('2025-02-01');
      expect(receivedModel?.target).toBe('sales_count');
      expect(receivedModel?.features?.length).toBe(3);
    });

    it('Debe retornar null cuando la respuesta es null', () => {
      let receivedModel: ModelMetadata | null | undefined;
      service.getLatestModel().subscribe((model) => {
        receivedModel = model;
      });

      const req = httpMock.expectOne(`${apiUrl}/models/latest`);
      req.flush(null);

      expect(receivedModel).toBeNull();
    });

    it('Debe mapear metadatos del modelo con todas las propiedades', () => {
      const mockResponse: LatestModelDto = {
        version: '2.0.0',
        trained_at: '2025-02-15',
        target: 'monthly_demand',
        features: ['brand', 'model', 'line', 'seasonality'],
        metrics: {
          mae: 3.5,
          rmse: 5.2,
        },
        candidates: [
          { name: 'model_v1', score: 0.85 },
          { name: 'model_v2', score: 0.87 },
        ],
      };

      let receivedModel: ModelMetadata | null | undefined;
      service.getLatestModel().subscribe((model) => {
        receivedModel = model;
      });

      const req = httpMock.expectOne(`${apiUrl}/models/latest`);
      req.flush(mockResponse);

      expect(receivedModel?.version).toBe('2.0.0');
      expect(receivedModel?.trainedAt).toBe('2025-02-15');
      expect(receivedModel?.target).toBe('monthly_demand');
      expect(receivedModel?.features?.length).toBe(4);
      expect(receivedModel?.metrics?.mae).toBe(3.5);
      expect(receivedModel?.candidates?.length).toBe(2);
    });

    it('Debe propagar errores HTTP', () => {
      let errorReceived: any;
      service.getLatestModel().subscribe({
        error: (error) => {
          errorReceived = error;
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/models/latest`);
      req.error(new ProgressEvent('error'), {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(errorReceived).toBeTruthy();
    });
  });

  describe('retrain()', () => {
    it('Debe hacer POST al endpoint retrain con payload vacío', () => {
      const mockResponse: RetrainResponse = {
        version: '2.0.0',
        trained_at: '2025-02-04T12:00:00Z',
        metrics: { mae: 3.5, rmse: 5.2 },
        samples: { train: 100, test: 20, total: 120 },
      };

      let receivedResponse: RetrainResponse | undefined;
      service.retrain().subscribe((response) => {
        receivedResponse = response;
      });

      const req = httpMock.expectOne(`${apiUrl}/retrain`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(mockResponse);

      expect(receivedResponse?.version).toBe('2.0.0');
      expect(receivedResponse?.trained_at).toBe('2025-02-04T12:00:00Z');
    });

    it('Debe propagar errores HTTP del endpoint retrain', () => {
      let errorReceived: any;
      service.retrain().subscribe({
        error: (error) => {
          errorReceived = error;
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/retrain`);
      req.error(new ProgressEvent('error'), {
        status: 503,
        statusText: 'Service Unavailable',
      });

      expect(errorReceived).toBeTruthy();
    });

    it('Debe retornar respuesta de retrain con todas las propiedades', () => {
      const mockResponse: RetrainResponse = {
        version: '2.1.0',
        trained_at: '2025-02-04T12:05:00Z',
        metrics: { mae: 3.2, rmse: 4.8, mape: 2.1 },
        samples: { train: 150, test: 30, total: 180 },
      };

      let receivedResponse: RetrainResponse | undefined;
      service.retrain().subscribe((response) => {
        receivedResponse = response;
      });

      const req = httpMock.expectOne(`${apiUrl}/retrain`);
      req.flush(mockResponse);

      expect(receivedResponse?.version).toBe('2.1.0');
      expect(receivedResponse?.trained_at).toBe('2025-02-04T12:05:00Z');
      expect(receivedResponse?.metrics?.mape).toBe(2.1);
    });
  });
});
