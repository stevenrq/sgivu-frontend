import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PurchaseSaleService } from './purchase-sale.service';
import { environment } from '../../../../environments/environment';
import { ContractType } from '../models/contract-type.enum';
import { ContractStatus } from '../models/contract-status.enum';
import { PaymentMethod } from '../models/payment-method.enum';

describe('PurchaseSaleService', () => {
  let service: PurchaseSaleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(PurchaseSaleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('searchPaginated()', () => {
    it('Debe hacer GET de compras/ventas paginadas con página y tamaño por defecto', () => {
      const mock = {
        page: 0,
        items: [
          {
            id: 1,
            clientId: 1,
            userId: 1,
            vehicleId: 1,
            contractType: ContractType.PURCHASE,
            contractStatus: ContractStatus.PENDING,
            paymentMethod: PaymentMethod.CASH,
            purchasePrice: 10000,
            salePrice: 12000,
            margin: 2000,
          },
        ],
      } as any;

      let received: any;
      service
        .searchPaginated({
          clientId: 1,
          contractType: ContractType.PURCHASE,
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/purchase-sales/search` &&
          request.params.get('page') === '0' &&
          request.params.get('size') === '10' &&
          request.params.get('clientId') === '1' &&
          request.params.get('contractType') === ContractType.PURCHASE
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe usar página y tamaño personalizados de los filtros', () => {
      const mock = { page: 2, items: [] } as any;

      let received: any;
      service
        .searchPaginated({ page: 2, size: 20 })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/purchase-sales/search` &&
          request.params.get('page') === '2' &&
          request.params.get('size') === '20'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe incluir todos los valores de filtro no vacíos en los parámetros', () => {
      const mock = { page: 0, items: [] } as any;

      let received: any;
      service
        .searchPaginated({
          page: 1,
          size: 15,
          clientId: 5,
          userId: 10,
          vehicleId: 20,
          contractType: ContractType.SALE,
          contractStatus: ContractStatus.COMPLETED,
          paymentMethod: PaymentMethod.CASHIERS_CHECK,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          minPurchasePrice: 5000,
          maxPurchasePrice: 15000,
          minSalePrice: 6000,
          maxSalePrice: 18000,
          term: 'test',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          params.get('page') === '1' &&
          params.get('size') === '15' &&
          params.get('clientId') === '5' &&
          params.get('userId') === '10' &&
          params.get('vehicleId') === '20' &&
          params.get('contractType') === ContractType.SALE &&
          params.get('contractStatus') === ContractStatus.COMPLETED &&
          params.get('paymentMethod') === PaymentMethod.CASHIERS_CHECK &&
          params.get('startDate') === '2025-01-01' &&
          params.get('endDate') === '2025-01-31' &&
          params.get('minPurchasePrice') === '5000' &&
          params.get('maxPurchasePrice') === '15000' &&
          params.get('minSalePrice') === '6000' &&
          params.get('maxSalePrice') === '18000' &&
          params.get('term') === 'test'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe excluir valores de filtro null y undefined', () => {
      const mock = { page: 0, items: [] } as any;

      let received: any;
      service
        .searchPaginated({
          clientId: undefined,
          userId: undefined,
          vehicleId: 1,
          contractType: '',
          contractStatus: '',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/purchase-sales/search` &&
          params.get('clientId') === null &&
          params.get('userId') === null &&
          params.get('contractType') === null &&
          params.get('contractStatus') === null &&
          params.get('vehicleId') === '1' &&
          params.get('page') === '0' &&
          params.get('size') === '10'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar resultados de búsqueda vacíos', () => {
      const mock = { page: 0, items: [] } as any;

      let received: any;
      service
        .searchPaginated({ page: 0, size: 10 })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/purchase-sales/search?page=0&size=10`,
      );
      req.flush(mock);

      expect(received.items.length).toBe(0);
    });
  });

  describe('buildReportParams()', () => {
    it('Debe retornar parámetros vacíos cuando ambas fechas son undefined', () => {
      const params = (service as any).buildReportParams(undefined, undefined);

      expect(params.keys().length).toBe(0);
    });

    it('Debe retornar parámetros vacíos cuando ambas fechas son null', () => {
      const params = (service as any).buildReportParams(null, null);

      expect(params.keys().length).toBe(0);
    });

    it('Debe incluir startDate cuando se proporciona', () => {
      const params = (service as any).buildReportParams(
        '2025-01-01',
        undefined,
      );

      expect(params.get('startDate')).toBe('2025-01-01');
      expect(params.get('endDate')).toBeNull();
    });

    it('Debe incluir endDate cuando se proporciona', () => {
      const params = (service as any).buildReportParams(
        undefined,
        '2025-01-31',
      );

      expect(params.get('startDate')).toBeNull();
      expect(params.get('endDate')).toBe('2025-01-31');
    });

    it('Debe incluir ambas fechas cuando se proporcionan', () => {
      const params = (service as any).buildReportParams(
        '2025-01-01',
        '2025-01-31',
      );

      expect(params.get('startDate')).toBe('2025-01-01');
      expect(params.get('endDate')).toBe('2025-01-31');
    });

    it('Debe ignorar startDate null e incluir endDate', () => {
      const params = (service as any).buildReportParams(null, '2025-01-31');

      expect(params.get('startDate')).toBeNull();
      expect(params.get('endDate')).toBe('2025-01-31');
    });

    it('Debe ignorar startDate undefined e incluir endDate', () => {
      const params = (service as any).buildReportParams(
        undefined,
        '2025-12-31',
      );

      expect(params.get('startDate')).toBeNull();
      expect(params.get('endDate')).toBe('2025-12-31');
    });
  });

  describe('getAvailableVehicleIds()', () => {
    it('Debe hacer GET al endpoint correcto y retornar los IDs', () => {
      const mockIds = [10, 20, 30];
      let received: number[] | undefined;

      service.getAvailableVehicleIds().subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/purchase-sales/available-vehicles`,
      );

      expect(req.request.method).toBe('GET');
      req.flush(mockIds);

      expect(received).toEqual(mockIds);
    });

    it('Debe retornar lista vacía cuando el backend lo hace', () => {
      let received: number[] | undefined;

      service.getAvailableVehicleIds().subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/purchase-sales/available-vehicles`,
      );

      req.flush([]);
      expect(received).toEqual([]);
    });
  });
});
