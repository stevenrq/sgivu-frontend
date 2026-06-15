import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { PurchaseSaleReportService } from './purchase-sale-report.service';
import { PurchaseSaleService } from './purchase-sale.service';

describe('PurchaseSaleReportService', () => {
  let service: PurchaseSaleReportService;
  let purchaseSaleServiceSpy: MockedObject<PurchaseSaleService>;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    purchaseSaleServiceSpy = {
      downloadPdf: vi.fn().mockName('PurchaseSaleService.downloadPdf'),
      downloadExcel: vi.fn().mockName('PurchaseSaleService.downloadExcel'),
      downloadCsv: vi.fn().mockName('PurchaseSaleService.downloadCsv'),
    } as unknown as MockedObject<PurchaseSaleService>;

    TestBed.configureTestingModule({
      providers: [
        PurchaseSaleReportService,
        { provide: PurchaseSaleService, useValue: purchaseSaleServiceSpy },
      ],
    });

    service = TestBed.inject(PurchaseSaleReportService);
    destroyRef = TestBed.inject(DestroyRef);

    // Silenciar alertas de Swal en la salida de prueba
    vi.spyOn(Swal, 'fire').mockReturnValue(
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
        expect.objectContaining({ icon: 'warning' }),
      );
      expect(purchaseSaleServiceSpy.downloadPdf).not.toHaveBeenCalled();
    });

    it('Debe descargar reporte PDF y mostrar alerta de éxito', () => {
      const mockBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
      purchaseSaleServiceSpy.downloadPdf.mockReturnValue(of(mockBlob));

      // Mock de creación de link
      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
        remove: () => {},
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => null as any,
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL');

      service.download('pdf', destroyRef);

      expect(purchaseSaleServiceSpy.downloadPdf).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'success' }),
      );
    });

    it('Debe descargar reporte Excel llamando al método correcto', () => {
      const mockBlob = new Blob(['xlsx-data']);
      purchaseSaleServiceSpy.downloadExcel.mockReturnValue(of(mockBlob));

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => null as any,
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL');

      service.download('excel', destroyRef);

      expect(purchaseSaleServiceSpy.downloadExcel).toHaveBeenCalled();
    });

    it('Debe descargar reporte CSV llamando al método correcto', () => {
      const mockBlob = new Blob(['csv-data']);
      purchaseSaleServiceSpy.downloadCsv.mockReturnValue(of(mockBlob));

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => null as any,
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL');

      service.download('csv', destroyRef);

      expect(purchaseSaleServiceSpy.downloadCsv).toHaveBeenCalled();
    });

    it('Debe mostrar alerta de error cuando falla la descarga', () => {
      purchaseSaleServiceSpy.downloadPdf.mockReturnValue(
        throwError(() => new Error('Server error')),
      );

      service.download('pdf', destroyRef);

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'error' }),
      );
    });

    it('Debe pasar fechas al servicio cuando se proporcionan', () => {
      const mockBlob = new Blob(['pdf-data']);
      purchaseSaleServiceSpy.downloadPdf.mockReturnValue(of(mockBlob));

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => null as any,
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL');

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

      expect(loading.pdf).toBe(false);
      expect(loading.excel).toBe(false);
      expect(loading.csv).toBe(false);
    });

    it('Debe establecer loading en false después de descarga exitosa', () => {
      const mockBlob = new Blob(['data']);
      purchaseSaleServiceSpy.downloadPdf.mockReturnValue(of(mockBlob));

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: () => {},
        remove: () => {},
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => null as any,
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL');

      service.download('pdf', destroyRef);

      expect(service.exportLoading().pdf).toBe(false);
    });

    it('Debe establecer loading en false después de error en descarga', () => {
      purchaseSaleServiceSpy.downloadExcel.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      service.download('excel', destroyRef);

      expect(service.exportLoading().excel).toBe(false);
    });
  });
});
