import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { VehicleImageService } from './vehicle-image.service';

describe('VehicleImageService', () => {
  let service: VehicleImageService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/v1/vehicles`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VehicleImageService],
    });
    service = TestBed.inject(VehicleImageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('solicita URL prefirmada con el content-type enviado', () => {
    service.createPresignedUploadUrl(1, 'image/jpeg').subscribe((resp) => {
      expect(resp).toEqual({ uploadUrl: 'url' } as any);
    });

    const req = httpMock.expectOne(`${apiUrl}/1/images/presigned-upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ contentType: 'image/jpeg' });
    req.flush({ uploadUrl: 'url' });
  });

  it('confirma la carga en el backend con los datos enviados', () => {
    const payload = {
      fileName: 'car.jpg',
      contentType: 'image/jpeg',
      size: 123,
      key: 'vehicles/1/file.jpg',
      primary: true,
    };

    service.confirmUpload(2, payload).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/2/images/confirm-upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('envía PUT a la URL prefirmada sin credenciales y retorna el cuerpo de la respuesta', (done) => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async () => {
      return new Response('ok', { status: 200 });
    });
    const file = new File(['img'], 'car.jpg', { type: 'image/jpeg' });

    service.uploadToPresignedUrl('https://s3/url', file, 'image/jpeg').subscribe((body) => {
      expect(body).toBe('ok');
      const args = fetchSpy.calls.mostRecent().args[1] as RequestInit;
      expect(args.credentials).toBe('omit');
      expect((args.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg');
      done();
    });
  });
});
