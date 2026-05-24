import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { PurchaseSaleReportService } from './purchase-sale-report.service';
import { PurchaseSaleService } from './purchase-sale.service';

describe('PurchaseSaleReportService', () => {
  let service: PurchaseSaleReportService;
  let purchaseSaleServiceSpy: jasmine.SpyObj<PurchaseSaleService>;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    purchaseSaleServiceSpy = jasmine.createSpyObj('PurchaseSaleService', [
      'downloadPdf',
      'downloadExcel',
      'downloadCsv',
    ]);

    TestBed.configureTestingModule({
      providers: [
        PurchaseSaleReportService,
        { provide: PurchaseSaleService, useValue: purchaseSaleServiceSpy },
      ],
    });

    service = TestBed.inject(PurchaseSaleReportService);
    destroyRef = TestBed.inject(DestroyRef);

    // Silenciar alertas de Swal en la salida de prueba
    spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({
        isConfirmed: false,
        isDenied: false,
        isDismissed: true,
      }),
    );
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('download()', () => {
    it('Debe mostrar alerta warning cuando el rango de fechas es inválido', () => {
      service.download('pdf', destroyRef, '2025-12-31', '2025-01-01');

      expect(Swal.fire).toHaveBeenCalledWith(
        jasmine.objectContaining({ icon: 'warning' }),
      );
      expect(purchaseSaleServiceSpy.downloadPdf).not.toHaveBeenCalled();
    });

    it('Debe descargar reporte PDF y mostrar alerta de éxito', () => {
      const mockBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
      purchaseSaleServiceSpy.downloadPdf.and.returnValue(of(mockBlob));

      // Mock de creación de link
      const clickSpy = jasmine.createSpy('click');
      spyOn(document, 'createElement').and.returnValue({
        href: '',
        download: '',
        click: clickSpy,
        remove: () => {},
      } as any);
      spyOn(document.body, 'appendChild').and.callFake(() => null as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');

      service.download('pdf', destroyRef);

      expect(purchaseSaleServiceSpy.downloadPdf).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledWith(
        jasmine.objectContaining({ icon: 'success' }),
      );
    });

    it('Debe descargar reporte Excel llamando al método correcto', () => {
      const mockBlob = new Blob(['xlsx-data']);
      purchaseSaleServiceSpy.downloadExcel.and.returnValue(of(mockBlob));

      spyOn(document, 'createElement').and.returnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      spyOn(document.body, 'appendChild').and.callFake(() => null as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');

      service.download('excel', destroyRef);

      expect(purchaseSaleServiceSpy.downloadExcel).toHaveBeenCalled();
    });

    it('Debe descargar reporte CSV llamando al método correcto', () => {
      const mockBlob = new Blob(['csv-data']);
      purchaseSaleServiceSpy.downloadCsv.and.returnValue(of(mockBlob));

      spyOn(document, 'createElement').and.returnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      spyOn(document.body, 'appendChild').and.callFake(() => null as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');

      service.download('csv', destroyRef);

      expect(purchaseSaleServiceSpy.downloadCsv).toHaveBeenCalled();
    });

    it('Debe mostrar alerta de error cuando falla la descarga', () => {
      purchaseSaleServiceSpy.downloadPdf.and.returnValue(
        throwError(() => new Error('Server error')),
      );

      service.download('pdf', destroyRef);

      expect(Swal.fire).toHaveBeenCalledWith(
        jasmine.objectContaining({ icon: 'error' }),
      );
    });

    it('Debe pasar fechas al servicio cuando se proporcionan', () => {
      const mockBlob = new Blob(['pdf-data']);
      purchaseSaleServiceSpy.downloadPdf.and.returnValue(of(mockBlob));

      spyOn(document, 'createElement').and.returnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      spyOn(document.body, 'appendChild').and.callFake(() => null as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');

      service.download('pdf', destroyRef, '2025-01-01', '2025-12-31');

      expect(purchaseSaleServiceSpy.downloadPdf).toHaveBeenCalledWith(
        '2025-01-01',
        '2025-12-31',
      );
    });
  });

  describe('exportLoading', () => {
    it('Debe inicializar todos los formatos como no cargando', () => {
      const loading = service.exportLoading();

      expect(loading.pdf).toBeFalse();
      expect(loading.excel).toBeFalse();
      expect(loading.csv).toBeFalse();
    });

    it('Debe establecer loading en false después de descarga exitosa', () => {
      const mockBlob = new Blob(['data']);
      purchaseSaleServiceSpy.downloadPdf.and.returnValue(of(mockBlob));

      spyOn(document, 'createElement').and.returnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      spyOn(document.body, 'appendChild').and.callFake(() => null as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');

      service.download('pdf', destroyRef);

      expect(service.exportLoading().pdf).toBeFalse();
    });

    it('Debe establecer loading en false después de error en descarga', () => {
      purchaseSaleServiceSpy.downloadExcel.and.returnValue(
        throwError(() => new Error('fail')),
      );

      service.download('excel', destroyRef);

      expect(service.exportLoading().excel).toBeFalse();
    });
  });
});
