import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CarService } from './car.service';
import { environment } from '../../../../environments/environment';
import { Car } from '../models/car.model';
import { VehicleStatus } from '../models/vehicle-status.enum';

describe('CarService', () => {
  let service: CarService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/cars`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CarService],
    });
    service = TestBed.inject(CarService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea un carro y lo agrega al estado', () => {
    const car = { id: 1, brand: 'Toyota', model: 'Corolla' } as Car;

    service.create(car).subscribe();
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    req.flush(car);

    expect((service as any).carsState()).toEqual([car]);
  });

  it('cambia estado y actualiza la cache local', () => {
    const existing = { id: 2, status: VehicleStatus.AVAILABLE } as Car;
    (service as any).carsState.set([existing]);

    service.changeStatus(2, VehicleStatus.SOLD).subscribe((status) => {
      expect(status).toBe(VehicleStatus.SOLD);
      expect((service as any).carsState()[0].status).toBe(VehicleStatus.SOLD);
    });

    const req = httpMock.expectOne(`${apiUrl}/2/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toContain(VehicleStatus.SOLD);
    req.flush({ status: VehicleStatus.SOLD });
  });

  it('convierte conteos crudos a formato de VehicleCount', () => {
    service.getCounts().subscribe((count) => {
      expect(count).toEqual({ total: 5, available: 3, unavailable: 2 });
    });

    const req = httpMock.expectOne(`${apiUrl}/count`);
    expect(req.request.method).toBe('GET');
    req.flush({
      totalCars: 5,
      availableCars: 3,
      unavailableCars: 2,
    });
  });
});
