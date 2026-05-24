import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PersonService } from './person.service';
import { environment } from '../../../../environments/environment';
import { buildSearchParams } from '../../../shared/utils/crud-operations.factory';
import { Person } from '../models/person.model';

describe('PersonService', () => {
  let service: PersonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(PersonService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reiniciar los estados internos de los signals
    service.getPersonsState().set([] as any);
    (service as any).crud._writablePagerState.set({} as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('create()', () => {
    it('Debe hacer POST de la nueva persona y agregarla al estado de personas', () => {
      const newPerson: Person = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        nationalId: 123456789,
        address: { street: '', number: '', city: '' },
        phoneNumber: '5551234567',
        email: 'john@example.com',
        enabled: true,
      };

      let received: any;
      service.create(newPerson).subscribe((p) => (received = p));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newPerson);

      req.flush(newPerson);

      expect(received).toEqual(newPerson);
      const state = service.getPersonsState()();
      expect(state).toContain(newPerson);
    });

    it('Debe agregar al estado existente de personas cuando no está vacío', () => {
      const existing = [
        {
          id: 2,
          firstName: 'Jane',
          lastName: 'Smith',
          nationalId: 987654321,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5559876543',
          email: 'jane@example.com',
          enabled: true,
        } as any,
      ];
      service.getPersonsState().set(existing as any);

      const newPerson: Person = {
        id: 3,
        firstName: 'Bob',
        lastName: 'Johnson',
        nationalId: 555555555,
        address: { street: '', number: '', city: '' },
        phoneNumber: '5555555555',
        email: 'bob@example.com',
        enabled: true,
      };
      service.create(newPerson).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
      req.flush(newPerson);

      const state = service.getPersonsState()();
      expect(state.length).toBe(2);
      expect(state.find((p: any) => p.id === 3)).toBeDefined();
    });

    it('Debe propagar error en falla de POST y no modificar el estado', (done) => {
      const initial = [
        {
          id: 5,
          firstName: 'Keep',
          lastName: 'Person',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'keep@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      service
        .create({
          id: 6,
          firstName: 'Bad',
          lastName: 'Person',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'bad@example.com',
          enabled: true,
        } as any)
        .subscribe({
          next: () => fail('should not succeed'),
          error: (err) => {
            expect(err).toBeDefined();
            const state = service.getPersonsState()();
            expect(state).toEqual(initial);
            done();
          },
        });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('getAll()', () => {
    it('Debe hacer GET de todas las personas y establecer el estado de personas', () => {
      const mock = [
        {
          id: 1,
          firstName: 'Alice',
          lastName: 'Anderson',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'alice@example.com',
          enabled: true,
        },
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Brown',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'bob@example.com',
          enabled: true,
        },
      ] as any[];

      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getPersonsState()()).toEqual(mock);
    });

    it('Debe manejar respuesta con lista vacía', () => {
      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
      req.flush([]);

      expect(received).toEqual([]);
      expect(service.getPersonsState()()).toEqual([]);
    });
  });

  describe('getAllPaginated()', () => {
    it('Debe hacer GET de personas paginadas y establecer el estado del paginador', () => {
      const mock = {
        page: 2,
        items: [
          {
            id: 3,
            firstName: 'Charlie',
            lastName: 'Clark',
            nationalId: 333333333,
            address: { street: '', number: '', city: '' },
            phoneNumber: '5553333333',
            email: 'charlie@example.com',
            enabled: true,
          },
        ],
      } as any;

      let received: any;
      service.getAllPaginated(2).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/page/2`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getPersonsPagerState()()).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 1, items: [] } as any;

      let received: any;
      service.getAllPaginated(1).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/page/1`);
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getPersonsPagerState()()).toEqual(mock);
    });
  });

  describe('update()', () => {
    it('Debe hacer PUT de la persona actualizada y actualizar el estado de personas', () => {
      const initial = [
        {
          id: 1,
          firstName: 'Old',
          lastName: 'Name',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'old@example.com',
          enabled: true,
        },
        {
          id: 2,
          firstName: 'Keep',
          lastName: 'Person',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'keep@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      const updated = {
        id: 1,
        firstName: 'New',
        lastName: 'Name',
        nationalId: 111111111,
        address: { street: '', number: '', city: '' },
        phoneNumber: '5551111111',
        email: 'new@example.com',
        enabled: true,
      } as any;

      let received: any;
      service.update(1, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getPersonsState()();
      const found = state.find((p: any) => p.id === 1);
      expect(found).toBeDefined();
      expect((found as any).firstName).toBe('New');
      expect(state.length).toBe(2);
    });

    it('Debe no alterar el estado al actualizar una persona inexistente', () => {
      const initial = [
        {
          id: 2,
          firstName: 'Keep',
          lastName: 'Person',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'keep@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      const updated = {
        id: 99,
        firstName: 'Ghost',
        lastName: 'Person',
        nationalId: 999999999,
        address: { street: '', number: '', city: '' },
        phoneNumber: '5559999999',
        email: 'ghost@example.com',
        enabled: true,
      } as any;

      let received: any;
      service.update(99, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/99`);
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getPersonsState()();
      expect(state).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [
        {
          id: 1,
          firstName: 'Old',
          lastName: 'Name',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'old@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      service
        .update(1, {
          id: 1,
          firstName: 'New',
          lastName: 'Name',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'new@example.com',
          enabled: true,
        } as any)
        .subscribe({
          next: () => fail('should error'),
          error: () => {
            expect(service.getPersonsState()()).toEqual(initial);
            done();
          },
        });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('delete()', () => {
    it('Debe hacer DELETE de la persona y eliminarla del estado de personas', () => {
      const initial = [
        {
          id: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'alice@example.com',
          enabled: true,
        },
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Jones',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'bob@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      let done = false;
      service.delete(1).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      const state = service.getPersonsState()();
      expect(state.find((p: any) => p.id === 1)).toBeUndefined();
      expect(state.length).toBe(1);
    });

    it('Debe dejar el estado sin cambios al eliminar un id inexistente', () => {
      const initial = [
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Jones',
          nationalId: 222222222,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5552222222',
          email: 'bob@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      let done = false;
      service.delete(3).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      expect(service.getPersonsState()()).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [
        {
          id: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          nationalId: 111111111,
          address: { street: '', number: '', city: '' },
          phoneNumber: '5551111111',
          email: 'alice@example.com',
          enabled: true,
        },
      ];
      service.getPersonsState().set(initial as any);

      service.delete(1).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getPersonsState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('buildSearchParams()', () => {
    it('Debe construir HttpParams ignorando valores vacíos/undefined y convertir booleanos a string', () => {
      const params = buildSearchParams({
        name: 'John',
        nationalId: '123456789',
        email: undefined,
        phoneNumber: '',
        enabled: true,
        city: null,
      });

      expect(params.get('name')).toBe('John');
      expect(params.get('nationalId')).toBe('123456789');
      expect(params.get('email')).toBeNull();
      expect(params.get('phoneNumber')).toBeNull();
      expect(params.get('enabled')).toBe('true');
      expect(params.get('city')).toBeNull();
    });

    it('Debe excluir todos los valores vacíos cuando ninguno se proporciona', () => {
      const params = buildSearchParams({
        name: undefined,
        nationalId: '',
        email: null,
        phoneNumber: undefined,
        enabled: '',
        city: null,
      });

      expect(params.keys().length).toBe(0);
    });

    it('Debe manejar booleano false correctamente', () => {
      const params = buildSearchParams({
        enabled: false,
      });

      expect(params.get('enabled')).toBe('false');
    });
  });
});
