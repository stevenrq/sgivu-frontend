import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CompanyService } from '../services/company.service';
import { environment } from '../../../../environments/environment';
import { buildSearchParams } from '../../../shared/utils/crud-operations.factory';
import { Company } from '../models/company.model';

describe('CompanyService', () => {
  let service: CompanyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(CompanyService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reiniciar los estados internos de los signals
    service.getCompaniesState().set([] as any);
    (service as any).crud._writablePagerState.set({} as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('create()', () => {
    it('Debe hacer POST de la nueva empresa y agregarla al estado de empresas', () => {
      const newCompany: Company = {
        id: 1,
        companyName: 'ACME',
        taxId: 0,
        address: { street: '', number: '', city: '' },
        phoneNumber: '',
        email: '',
        enabled: true,
      };

      let received: any;
      service.create(newCompany).subscribe((c) => (received = c));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newCompany);

      req.flush(newCompany);

      expect(received).toEqual(newCompany);
      const state = service.getCompaniesState()();
      expect(state).toContain(newCompany);
    });

    it('Debe agregar al estado existente de empresas cuando no está vacío', () => {
      const existing = [
        {
          id: 2,
          companyName: 'Existing',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        } as any,
      ];
      service.getCompaniesState().set(existing as any);

      const newCompany: Company = {
        id: 3,
        companyName: 'NewCo',
        taxId: 0,
        address: { street: '', number: '', city: '' },
        phoneNumber: '',
        email: '',
        enabled: true,
      };
      service.create(newCompany).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
      req.flush(newCompany);

      const state = service.getCompaniesState()();
      expect(state.length).toBe(2);
      expect(state.find((c: any) => c.id === 3)).toBeDefined();
    });

    it('Debe propagar error en falla de POST y no modificar el estado', (done) => {
      const initial = [
        {
          id: 5,
          companyName: 'Keep',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      service
        .create({
          id: 6,
          companyName: 'Bad',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        } as any)
        .subscribe({
          next: () => fail('should not succeed'),
          error: (err) => {
            expect(err).toBeDefined();
            const state = service.getCompaniesState()();
            expect(state).toEqual(initial);
            done();
          },
        });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('getAll()', () => {
    it('Debe hacer GET de todas las empresas y establecer el estado de empresas', () => {
      const mock = [
        {
          id: 1,
          companyName: 'A',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
        {
          id: 2,
          companyName: 'B',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ] as any[];

      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getCompaniesState()()).toEqual(mock);
    });

    it('Debe manejar respuesta con lista vacía', () => {
      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
      req.flush([]);

      expect(received).toEqual([]);
      expect(service.getCompaniesState()()).toEqual([]);
    });
  });

  describe('getAllPaginated()', () => {
    it('Debe hacer GET de empresas paginadas y establecer el estado del paginador', () => {
      const mock = {
        page: 2,
        items: [
          {
            id: 3,
            companyName: 'C',
            taxId: 0,
            address: { street: '', number: '', city: '' },
            phoneNumber: '',
            email: '',
            enabled: true,
          },
        ],
      } as any;

      let received: any;
      service.getAllPaginated(2).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/companies/page/2`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getCompaniesPagerState()()).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 1, items: [] } as any;

      let received: any;
      service.getAllPaginated(1).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/companies/page/1`,
      );
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getCompaniesPagerState()()).toEqual(mock);
    });
  });

  describe('update()', () => {
    it('Debe hacer PUT de la empresa actualizada y actualizar el estado de empresas', () => {
      const initial = [
        {
          id: 1,
          companyName: 'Old',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
        {
          id: 2,
          companyName: 'Keep',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      const updated = {
        id: 1,
        companyName: 'New',
        taxId: 0,
        address: { street: '', number: '', city: '' },
        phoneNumber: '',
        email: '',
        enabled: true,
      } as any;

      let received: any;
      service.update(1, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getCompaniesState()();
      const found = state.find((c: any) => c.id === 1);
      expect(found).toBeDefined();
      expect((found as any).companyName).toBe('New');
      expect(state.length).toBe(2);
    });

    it('Debe no alterar el estado al actualizar una empresa inexistente', () => {
      const initial = [
        {
          id: 2,
          companyName: 'Keep',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      const updated = {
        id: 99,
        companyName: 'Ghost',
        taxId: 0,
        address: { street: '', number: '', city: '' },
        phoneNumber: '',
        email: '',
        enabled: true,
      } as any;

      let received: any;
      service.update(99, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/99`);
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getCompaniesState()();
      expect(state).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [
        {
          id: 1,
          companyName: 'Old',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      service
        .update(1, {
          id: 1,
          companyName: 'New',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        } as any)
        .subscribe({
          next: () => fail('should error'),
          error: () => {
            expect(service.getCompaniesState()()).toEqual(initial);
            done();
          },
        });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('delete()', () => {
    it('Debe hacer DELETE de la empresa y eliminarla del estado de empresas', () => {
      const initial = [
        {
          id: 1,
          companyName: 'A',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
        {
          id: 2,
          companyName: 'B',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      let done = false;
      service.delete(1).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      const state = service.getCompaniesState()();
      expect(state.find((c: any) => c.id === 1)).toBeUndefined();
      expect(state.length).toBe(1);
    });

    it('Debe dejar el estado sin cambios al eliminar un id inexistente', () => {
      const initial = [
        {
          id: 2,
          companyName: 'B',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      let done = false;
      service.delete(3).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      expect(service.getCompaniesState()()).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [
        {
          id: 1,
          companyName: 'A',
          taxId: 0,
          address: { street: '', number: '', city: '' },
          phoneNumber: '',
          email: '',
          enabled: true,
        },
      ];
      service.getCompaniesState().set(initial as any);

      service.delete(1).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getCompaniesState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('buildSearchParams()', () => {
    it('Debe construir HttpParams ignorando valores vacíos/undefined y convertir booleanos a string', () => {
      const params = buildSearchParams({
        companyName: 'ACME',
        taxId: 'TAX123',
        email: undefined,
        phoneNumber: '',
        enabled: true,
        city: null,
      });

      expect(params.get('companyName')).toBe('ACME');
      expect(params.get('taxId')).toBe('TAX123');
      expect(params.get('email')).toBeNull();
      expect(params.get('phoneNumber')).toBeNull();
      expect(params.get('enabled')).toBe('true');
      expect(params.get('city')).toBeNull();
    });
  });
});
