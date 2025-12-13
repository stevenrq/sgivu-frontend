import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DemandPredictionService } from './demand-prediction.service';
import { environment } from '../../../environments/environment';

describe('DemandPredictionService', () => {
  let service: DemandPredictionService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/ml`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DemandPredictionService],
    });

    service = TestBed.inject(DemandPredictionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('normaliza payload y mapea predicciones', () => {
    service
      .predict({
        vehicleType: 'CAR',
        brand: 'toyota',
        model: 'corolla',
        line: 'seg',
        horizonMonths: 30,
        confidence: 0.8,
      })
      .subscribe((response) => {
        expect(response.predictions[0]).toEqual({
          month: '2024-01-01',
          demand: 10,
          lowerCi: 8,
          upperCi: 12,
        });
        expect(response.history?.[0]).toEqual({
          month: '2023-12-01',
          salesCount: 5,
        });
      });

    const req = httpMock.expectOne(`${apiUrl}/predict-with-history`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      jasmine.objectContaining({
        vehicle_type: 'CAR',
        brand: 'TOYOTA',
        model: 'COROLLA',
        line: 'SEG',
        horizon_months: 24, // top máximo
        confidence: 0.8,
      }),
    );

    req.flush({
      predictions: [{ month: '2024-01-01', demand: 10, lower_ci: 8, upper_ci: 12 }],
      history: [{ month: '2023-12-01', sales_count: 5 }],
      model_version: 'v1',
    });
  });

  it('mapea el modelo más reciente', () => {
    service.getLatestModel().subscribe((model) => {
      expect(model).toEqual(
        jasmine.objectContaining({ version: 'v2', trainedAt: '2024-01-01' }),
      );
    });

    const req = httpMock.expectOne(`${apiUrl}/models/latest`);
    expect(req.request.method).toBe('GET');
    req.flush({
      version: 'v2',
      trained_at: '2024-01-01',
      target: 'sales',
      features: ['brand'],
    });
  });
});
