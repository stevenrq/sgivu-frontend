import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MotorcycleService } from './motorcycle.service';
import { environment } from '../../../../environments/environment';
import { Motorcycle } from '../models/motorcycle.model';
import { VehicleStatus } from '../models/vehicle-status.enum';

describe('MotorcycleService', () => {
  let service: MotorcycleService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/motorcycles`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MotorcycleService],
    });
    service = TestBed.inject(MotorcycleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea y agrega motocicletas al estado', () => {
    const moto = { id: 1, brand: 'Yamaha', model: 'MT-07' } as Motorcycle;
    service.create(moto).subscribe();

    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    req.flush(moto);

    expect((service as any).motorcyclesState()).toEqual([moto]);
  });

  it('cambia estado y sincroniza la cache local', () => {
    const existing = { id: 2, status: VehicleStatus.AVAILABLE } as Motorcycle;
    (service as any).motorcyclesState.set([existing]);

    service.changeStatus(2, VehicleStatus.IN_REPAIR).subscribe((status) => {
      expect(status).toBe(VehicleStatus.IN_REPAIR);
      expect((service as any).motorcyclesState()[0].status).toBe(
        VehicleStatus.IN_REPAIR,
      );
    });

    const req = httpMock.expectOne(`${apiUrl}/2/status`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ status: VehicleStatus.IN_REPAIR });
  });

  it('arma params de búsqueda omitiendo vacíos', () => {
    service.search({ plate: 'ABC123', brand: '', model: undefined }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${apiUrl}/search` &&
        request.params.get('plate') === 'ABC123' &&
        !request.params.has('model'),
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
