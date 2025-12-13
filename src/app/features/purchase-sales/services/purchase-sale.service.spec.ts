import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PurchaseSaleService } from './purchase-sale.service';
import { environment } from '../../../../environments/environment';
import { ContractType } from '../models/contract-type.enum';

describe('PurchaseSaleService', () => {
  let service: PurchaseSaleService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/purchase-sales`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PurchaseSaleService],
    });

    service = TestBed.inject(PurchaseSaleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea contratos y obtiene todos los detallados', () => {
    service.create({} as any).subscribe();
    const createReq = httpMock.expectOne(apiUrl);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({});

    service.getAll().subscribe();
    const getReq = httpMock.expectOne(`${apiUrl}/detailed`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush([]);
  });

  it('arma filtros paginados ignorando valores vacíos', () => {
    service
      .searchPaginated({
        page: 2,
        size: 20,
        contractType: ContractType.SALE,
        clientId: null,
        term: 'abc',
      })
      .subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${apiUrl}/search` &&
        request.params.get('page') === '2' &&
        request.params.get('size') === '20' &&
        request.params.get('contractType') === ContractType.SALE &&
        request.params.get('term') === 'abc' &&
        !request.params.has('clientId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({ content: [] });
  });

  it('genera reportes agregando fechas solo si existen', () => {
    service.downloadPdf('2024-01-01', null).subscribe();
    const pdfReq = httpMock.expectOne(
      (request) =>
        request.url === `${apiUrl}/report/pdf` &&
        request.params.get('startDate') === '2024-01-01' &&
        !request.params.has('endDate') &&
        request.responseType === 'blob',
    );
    expect(pdfReq.request.method).toBe('GET');
    pdfReq.flush(new Blob());

    service.downloadExcel(undefined, '2024-12-31').subscribe();
    const excelReq = httpMock.expectOne(
      (request) =>
        request.url === `${apiUrl}/report/excel` &&
        request.params.get('endDate') === '2024-12-31',
    );
    expect(excelReq.request.method).toBe('GET');
    excelReq.flush(new Blob());
  });
});
