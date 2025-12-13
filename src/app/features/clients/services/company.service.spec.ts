import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CompanyService } from './company.service';
import { environment } from '../../../../environments/environment';
import { Company } from '../models/company.model';

describe('CompanyService', () => {
  let service: CompanyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CompanyService],
    });

    service = TestBed.inject(CompanyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea empresas y actualiza la señal de estado', () => {
    const company: Company = {
      id: 1,
      companyName: 'SGIVU',
      taxId: 800,
      email: 'c@example.com',
      phoneNumber: '123',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      enabled: true,
    };

    service.create(company).subscribe(() => {
      expect((service as any).companiesState()).toEqual([company]);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies`);
    expect(req.request.method).toBe('POST');
    req.flush(company);
  });

  it('elimina empresas y limpia cache', () => {
    const existing = { id: 2 } as Company;
    (service as any).companiesState.set([existing]);

    service.delete(existing.id!).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/v1/companies/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
    expect((service as any).companiesState()).toEqual([]);
  });

  it('construye parámetros de búsqueda ignorando vacíos', () => {
    service.search({
      companyName: 'SGIVU',
      taxId: '',
      enabled: 'true',
    }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/v1/companies/search` &&
        request.params.get('companyName') === 'SGIVU' &&
        request.params.get('enabled') === 'true' &&
        !request.params.has('taxId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
