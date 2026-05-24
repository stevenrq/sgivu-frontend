import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { VehicleImageService } from './vehicle-image.service';
import { environment } from '../../../../environments/environment';
import { VehicleImageResponse } from '../models/vehicle-image-response';
import { VehicleImageConfirmUploadRequest } from '../models/vehicle-image-confirm-upload';

describe('VehicleImageService', () => {
  let service: VehicleImageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(VehicleImageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('getImages()', () => {
    it('Debe hacer GET de imágenes de un vehículo', () => {
      const vehicleId = 1;
      const mock: VehicleImageResponse[] = [
        {
          id: 1,
          vehicleId: 1,
          imageUrl: 'https://example.com/img1.jpg',
          uploadedAt: '2025-02-01T10:00:00Z',
        } as any,
        {
          id: 2,
          vehicleId: 1,
          imageUrl: 'https://example.com/img2.jpg',
          uploadedAt: '2025-02-01T11:00:00Z',
        } as any,
      ];

      let received: any[] | undefined;
      service.getImages(vehicleId).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar lista de imágenes vacía', () => {
      const vehicleId = 2;

      let received: any[] | undefined;
      service.getImages(vehicleId).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images`,
      );
      req.flush([]);

      expect(received).toEqual([]);
    });
  });

  describe('createPresignedUploadUrl()', () => {
    it('Debe hacer POST y recibir respuesta de URL presignada de carga', () => {
      const vehicleId = 1;
      const contentType = 'image/jpeg';
      const mock = {
        uploadUrl: 'https://s3.example.com/presigned-url',
        expiration: 3600,
      };

      let received: any;
      service
        .createPresignedUploadUrl(vehicleId, contentType)
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images/presigned-upload`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ contentType });
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(received.uploadUrl).toBe('https://s3.example.com/presigned-url');
    });
  });

  describe('uploadToPresignedUrl()', () => {
    it('Debe subir archivo a URL presignada y retornar cuerpo de respuesta', (done) => {
      const url = 'https://s3.example.com/presigned-url';
      const file = new File(['test content'], 'test.jpg', {
        type: 'image/jpeg',
      });
      const contentType = 'image/jpeg';
      const responseBody = '';

      spyOn(globalThis, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(responseBody, {
            status: 200,
            statusText: 'OK',
          }),
        ),
      );

      service
        .uploadToPresignedUrl(url, file, contentType)
        .subscribe((received) => {
          expect(received).toBe(responseBody);
          expect(globalThis.fetch).toHaveBeenCalledWith(url, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
            credentials: 'omit',
            mode: 'cors',
            cache: 'no-store',
          });
          done();
        });
    });

    it('Debe manejar respuesta de error HTTP desde URL presignada', (done) => {
      const url = 'https://s3.example.com/presigned-url';
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const contentType = 'image/jpeg';
      const errorMessage = 'Access Denied';

      spyOn(globalThis, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(errorMessage, {
            status: 403,
            statusText: 'Forbidden',
          }),
        ),
      );

      service.uploadToPresignedUrl(url, file, contentType).subscribe({
        next: () => fail('should error'),
        error: (err) => {
          expect(err.message).toBe('Fallo en la subida de la imagen');
          expect(err.status).toBe(403);
          expect(err.error).toBe(errorMessage);
          done();
        },
      });
    });

    it('Debe manejar error de red en fetch', (done) => {
      const url = 'https://s3.example.com/presigned-url';
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const contentType = 'image/jpeg';
      const networkError = new Error('Network error');

      spyOn(globalThis, 'fetch').and.returnValue(Promise.reject(networkError));

      service.uploadToPresignedUrl(url, file, contentType).subscribe({
        next: () => fail('should error'),
        error: (err) => {
          expect(err).toBe(networkError);
          done();
        },
      });
    });
  });

  describe('confirmUpload()', () => {
    it('Debe hacer POST de confirmación de carga de imagen', () => {
      const vehicleId = 1;
      const payload: VehicleImageConfirmUploadRequest = {
        etag: '"abc123def456"',
        versionId: 'v123456',
      } as any;

      let received: any;
      service
        .confirmUpload(vehicleId, payload)
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images/confirm-upload`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({} as any);

      expect(received).toBeDefined();
    });
  });

  describe('deleteImage()', () => {
    it('Debe hacer DELETE de imagen del vehículo', () => {
      const vehicleId = 1;
      const imageId = 5;

      let done = false;
      service.deleteImage(vehicleId, imageId).subscribe(() => (done = true));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images/${imageId}`,
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
    });

    it('Debe manejar error de eliminación (404 imagen no encontrada)', (done) => {
      const vehicleId = 1;
      const imageId = 999;

      service.deleteImage(vehicleId, imageId).subscribe({
        next: () => fail('should error'),
        error: (err) => {
          expect(err).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/vehicles/${vehicleId}/images/${imageId}`,
      );
      req.error(new ProgressEvent('error'));
    });
  });
});
