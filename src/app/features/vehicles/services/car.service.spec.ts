import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CarService } from '../services/car.service';
import { environment } from '../../../../environments/environment';
import { buildSearchParams } from '../../../shared/utils/crud-operations.factory';
import { Car } from '../models/car.model';
import { VehicleStatus } from '../models/vehicle-status.enum';

describe('CarService', () => {
  let service: CarService;
  let httpMock: HttpTestingController;

  const buildCar = (overrides: Partial<Car> = {}): Car =>
    ({
      id: 1,
      plate: 'ABC123',
      brand: 'Toyota',
      line: 'Corolla',
      model: '2024',
      fuelType: 'Gasoline',
      bodyType: 'Sedan',
      transmission: 'Automatic',
      year: 2024,
      capacity: 5,
      mileage: 0,
      salePrice: 25000,
      status: VehicleStatus.AVAILABLE,
      cityRegistered: 'Bogotá',
      enabled: true,
      ...overrides,
    }) as Car;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(CarService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reiniciar los estados internos de los signals
    service.getState().set([] as any);
    (service as any).crud._writablePagerState.set({} as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('create()', () => {
    it('Debe hacer POST del nuevo automóvil y agregarlo al estado de automóviles', () => {
      const newCar = buildCar({ id: 1, plate: 'XYZ789' });

      let received: any;
      service.create(newCar).subscribe((c) => (received = c));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newCar);

      req.flush(newCar);

      expect(received).toEqual(newCar);
      const state = service.getState()();
      expect(state).toContain(newCar);
    });

    it('Debe agregar al estado existente de automóviles cuando no está vacío', () => {
      const existing = [buildCar({ id: 2, plate: 'OLD123' })] as any;
      service.getState().set(existing);

      const newCar = buildCar({ id: 3, plate: 'NEW456' });
      service.create(newCar).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars`);
      req.flush(newCar);

      const state = service.getState()();
      expect(state.length).toBe(2);
      expect(state.find((c: any) => c.id === 3)).toBeDefined();
    });

    it('Debe propagar error en falla de POST y no modificar el estado', (done) => {
      const initial = [buildCar({ id: 5 })] as any;
      service.getState().set(initial);

      service.create(buildCar({ id: 6, plate: 'BAD999' })).subscribe({
        next: () => fail('should not succeed'),
        error: (err) => {
          expect(err).toBeDefined();
          const state = service.getState()();
          expect(state).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('getAll()', () => {
    it('Debe hacer GET de todos los automóviles y establecer el estado de automóviles', () => {
      const mock = [
        buildCar({ id: 1, plate: 'AAA001' }),
        buildCar({ id: 2, plate: 'AAA002' }),
      ] as any[];

      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getState()()).toEqual(mock);
    });

    it('Debe manejar respuesta con lista vacía', () => {
      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars`);
      req.flush([]);

      expect(received).toEqual([]);
      expect(service.getState()()).toEqual([]);
    });
  });

  describe('getAllPaginated()', () => {
    it('Debe hacer GET de automóviles paginados y establecer el estado del paginador', () => {
      const mock = {
        page: 2,
        content: [buildCar({ id: 3, plate: 'AAA003' })],
      } as any;

      let received: any;
      service.getAllPaginated(2).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/page/2`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getPagerState()()).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 1, content: [] } as any;

      let received: any;
      service.getAllPaginated(1).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/page/1`);
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getPagerState()()).toEqual(mock);
    });
  });

  describe('getCounts()', () => {
    it('Debe hacer GET de conteos de automóviles y transformar la respuesta', () => {
      const mock = {
        totalCars: 100,
        availableCars: 75,
        unavailableCars: 25,
      };

      let received: any;
      service.getCounts().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/count`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual({
        total: 100,
        available: 75,
        unavailable: 25,
      });
    });

    it('Debe transformar conteos en cero correctamente', () => {
      const mock = {
        totalCars: 0,
        availableCars: 0,
        unavailableCars: 0,
      };

      let received: any;
      service.getCounts().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/count`);
      req.flush(mock);

      expect(received).toEqual({
        total: 0,
        available: 0,
        unavailable: 0,
      });
    });
  });

  describe('update()', () => {
    it('Debe hacer PUT del automóvil actualizado y actualizar el estado de automóviles', () => {
      const initial = [
        buildCar({ id: 1, plate: 'OLD001' }),
        buildCar({ id: 2, plate: 'KEEP001' }),
      ];
      service.getState().set(initial as any);

      const updated = buildCar({ id: 1, plate: 'NEW001' });

      let received: any;
      service.update(1, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getState()();
      const found = state.find((c: any) => c.id === 1);
      expect(found).toBeDefined();
      expect((found as any).plate).toBe('NEW001');
      expect(state.length).toBe(2);
    });

    it('Debe no alterar el estado al actualizar un automóvil inexistente', () => {
      const initial = [buildCar({ id: 2, plate: 'KEEP001' })] as any;
      service.getState().set(initial);

      const updated = buildCar({ id: 99, plate: 'GHOST999' });

      let received: any;
      service.update(99, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/99`);
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getState()();
      expect(state).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [buildCar({ id: 1, plate: 'OLD001' })] as any;
      service.getState().set(initial);

      service.update(1, buildCar({ id: 1, plate: 'NEW001' })).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('changeStatus()', () => {
    it('Debe hacer PATCH del estado del automóvil y actualizar el estado de automóviles', () => {
      const initial = [buildCar({ id: 1, status: VehicleStatus.AVAILABLE })];
      service.getState().set(initial as any);

      let received: any;
      service
        .changeStatus(1, VehicleStatus.IN_MAINTENANCE)
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1/status`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ status: VehicleStatus.IN_MAINTENANCE });

      expect(received).toBe(VehicleStatus.IN_MAINTENANCE);
      const state = service.getState()();
      const found = state.find((c: any) => c.id === 1);
      expect((found as any).status).toBe(VehicleStatus.IN_MAINTENANCE);
    });

    it('Debe manejar error de cambio de estado correctamente', (done) => {
      const initial = [buildCar({ id: 1, status: VehicleStatus.AVAILABLE })];
      service.getState().set(initial as any);

      service.changeStatus(1, VehicleStatus.IN_MAINTENANCE).subscribe({
        next: () => fail('should error'),
        error: () => {
          const state = service.getState()();
          expect((state[0] as any).status).toBe(VehicleStatus.AVAILABLE);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1/status`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('delete()', () => {
    it('Debe hacer DELETE del automóvil y eliminarlo del estado de automóviles', () => {
      const initial = [
        buildCar({ id: 1, plate: 'DEL001' }),
        buildCar({ id: 2, plate: 'KEEP001' }),
      ];
      service.getState().set(initial as any);

      let done = false;
      service.delete(1).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      const state = service.getState()();
      expect(state.find((c: any) => c.id === 1)).toBeUndefined();
      expect(state.length).toBe(1);
    });

    it('Debe dejar el estado sin cambios al eliminar un id inexistente', () => {
      const initial = [buildCar({ id: 2, plate: 'KEEP001' })] as any;
      service.getState().set(initial);

      let done = false;
      service.delete(3).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      expect(service.getState()()).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [buildCar({ id: 1, plate: 'DEL001' })] as any;
      service.getState().set(initial);

      service.delete(1).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/cars/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('search()', () => {
    it('Debe hacer GET de automóviles que coincidan con los filtros', () => {
      const mock = [buildCar({ id: 1, brand: 'Toyota' })] as any[];

      let received: any[] | undefined;
      service
        .search({ brand: 'Toyota', fuelType: 'Gasoline' })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/cars/search` &&
          request.params.get('brand') === 'Toyota' &&
          request.params.get('fuelType') === 'Gasoline'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe excluir valores de filtro null y undefined', () => {
      const mock = [] as any[];

      let received: any[] | undefined;
      service
        .search({
          brand: 'Honda',
          fuelType: undefined,
          bodyType: '',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/cars/search` &&
          params.get('brand') === 'Honda' &&
          params.get('fuelType') === null &&
          params.get('bodyType') === null
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar resultados de búsqueda vacíos', () => {
      let received: any[] | undefined;
      service.search({ brand: 'NotExist' }).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/cars/search?brand=NotExist`,
      );
      req.flush([]);

      expect(received).toEqual([]);
    });
  });

  describe('searchPaginated()', () => {
    it('Debe hacer GET de automóviles paginados que coincidan con los filtros', () => {
      const mock = {
        page: 1,
        content: [buildCar({ id: 1, brand: 'Toyota' })],
      } as any;

      let received: any;
      service
        .searchPaginated(1, { brand: 'Toyota' })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/cars/search/page/1` &&
          request.params.get('brand') === 'Toyota'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe excluir filtros null y undefined en búsqueda paginada', () => {
      const mock = { page: 0, content: [] } as any;

      let received: any;
      service
        .searchPaginated(0, {
          brand: 'Honda',
          fuelType: undefined,
          bodyType: '',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/cars/search/page/0` &&
          params.get('brand') === 'Honda' &&
          params.get('fuelType') === null &&
          params.get('bodyType') === null
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe incluir filtros de rango numérico en búsqueda paginada', () => {
      const mock = { page: 0, content: [] } as any;

      let received: any;
      service
        .searchPaginated(0, {
          brand: 'BMW',
          minYear: 2020,
          maxYear: 2024,
          minSalePrice: 30000,
          maxSalePrice: 50000,
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/cars/search/page/0` &&
          params.get('brand') === 'BMW' &&
          params.get('minYear') === '2020' &&
          params.get('maxYear') === '2024' &&
          params.get('minSalePrice') === '30000' &&
          params.get('maxSalePrice') === '50000'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 5, content: [] } as any;

      let received: any;
      service
        .searchPaginated(5, { status: VehicleStatus.IN_MAINTENANCE })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/cars/search/page/5` &&
          request.params.get('status') === VehicleStatus.IN_MAINTENANCE
        );
      });

      req.flush(mock);

      expect(received.content.length).toBe(0);
    });
  });

  describe('buildSearchParams()', () => {
    it('Debe construir HttpParams de los filtros excluyendo valores vacíos', () => {
      const params = buildSearchParams({
        brand: 'Toyota',
        plate: 'ABC123',
        year: 2024,
      });

      expect(params.get('brand')).toBe('Toyota');
      expect(params.get('plate')).toBe('ABC123');
      expect(params.get('year')).toBe('2024');
    });

    it('Debe excluir valores undefined, null y string vacío', () => {
      const params = buildSearchParams({
        brand: 'Honda',
        line: undefined,
        bodyType: null,
        fuelType: '',
        model: 'Civic',
      });

      expect(params.get('brand')).toBe('Honda');
      expect(params.get('model')).toBe('Civic');
      expect(params.get('line')).toBeNull();
      expect(params.get('bodyType')).toBeNull();
      expect(params.get('fuelType')).toBeNull();
    });

    it('Debe convertir valores numéricos a strings', () => {
      const params = buildSearchParams({
        minYear: 2020,
        maxYear: 2024,
        minMileage: 1000,
        maxMileage: 50000,
        minSalePrice: 20000,
      });

      expect(params.get('minYear')).toBe('2020');
      expect(params.get('maxYear')).toBe('2024');
      expect(params.get('minMileage')).toBe('1000');
      expect(params.get('maxMileage')).toBe('50000');
      expect(params.get('minSalePrice')).toBe('20000');
    });

    it('Debe manejar objeto de filtros vacío', () => {
      const params = buildSearchParams({});

      expect(params.keys().length).toBe(0);
    });

    it('Debe manejar valores numéricos en cero', () => {
      const params = buildSearchParams({
        minYear: 0,
        minMileage: 0,
        minSalePrice: 0,
      });

      expect(params.get('minYear')).toBe('0');
      expect(params.get('minMileage')).toBe('0');
      expect(params.get('minSalePrice')).toBe('0');
    });
  });
});
