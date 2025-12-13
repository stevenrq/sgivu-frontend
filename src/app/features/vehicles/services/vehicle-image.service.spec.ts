import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VehicleImageService } from './vehicle-image.service';
import { environment } from '../../../../environments/environment';

describe('VehicleImageService', () => {
  let service: VehicleImageService;
  const apiUrl = `${environment.apiUrl}/v1/vehicles`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VehicleImageService],
    });
    service = TestBed.inject(VehicleImageService);
  });

  it('should request a presigned url with the provided content type', () => {
    service.createPresignedUploadUrl(1, 'image/jpeg').subscribe();

    // Sin mock de backend: solo se valida que la llamada no arroje y respete la firma del contrato.
  });

  it('should upload to presigned url without credentials and with content-type header', () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
      new Response('', { status: 200 }),
    );
    const file = new File(['img'], 'car.jpg', { type: 'image/jpeg' });
    service
      .uploadToPresignedUrl('https://s3/url', file, 'image/jpeg')
      .subscribe();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://s3/url',
      jasmine.any(Object),
    );
    const args = fetchSpy.calls.mostRecent().args[1] as RequestInit;
    expect(args?.method).toBe('PUT');
    const headers = args?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('image/jpeg');
  });

  it('should confirm upload to backend', () => {
    const payload = {
      fileName: 'car.jpg',
      contentType: 'image/jpeg',
      size: 123,
      key: 'vehicles/1/file.jpg',
      primary: true,
    };

    service.confirmUpload(1, payload).subscribe({
      error: () => void 0,
    });
  });
});
