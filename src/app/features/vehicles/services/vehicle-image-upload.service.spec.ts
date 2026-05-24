import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';
import { of, throwError } from 'rxjs';
import { VehicleImageUploadService } from './vehicle-image-upload.service';
import { VehicleImageService } from './vehicle-image.service';

describe('VehicleImageUploadService', () => {
  let service: VehicleImageUploadService;
  let vehicleImageServiceSpy: jasmine.SpyObj<VehicleImageService>;

  beforeEach(() => {
    vehicleImageServiceSpy = jasmine.createSpyObj('VehicleImageService', [
      'createPresignedUploadUrl',
      'uploadToPresignedUrl',
      'confirmUpload',
      'deleteImage',
    ]);

    TestBed.configureTestingModule({
      providers: [
        VehicleImageUploadService,
        { provide: VehicleImageService, useValue: vehicleImageServiceSpy },
      ],
    });

    service = TestBed.inject(VehicleImageUploadService);

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

  describe('processFileSelection()', () => {
    it('Debe retornar null cuando no hay archivos seleccionados', () => {
      const event = { target: { files: null } } as any;

      const result = service.processFileSelection(event);

      expect(result).toBeNull();
    });

    it('Debe retornar null cuando la lista de archivos está vacía', () => {
      const event = { target: { files: [], length: 0 } } as any;

      const result = service.processFileSelection(event);

      expect(result).toBeNull();
    });

    it('Debe retornar archivos válidos y URL de previsualización para imágenes', () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const mockUrl = 'blob:http://localhost/fake-url';
      spyOn(URL, 'createObjectURL').and.returnValue(mockUrl);

      const input = { files: [mockFile], value: '' } as any;
      const event = { target: input } as any;

      const result = service.processFileSelection(event);

      expect(result).toBeTruthy();
      expect(result!.files.length).toBe(1);
      expect(result!.files[0]).toBe(mockFile);
      expect(result!.previewUrl).toBe(mockUrl);
    });

    it('Debe retornar null y mostrar alerta cuando hay archivos no-imagen', () => {
      const textFile = new File(['data'], 'doc.txt', { type: 'text/plain' });
      const input = { files: [textFile], value: '' } as any;
      const event = { target: input } as any;

      const result = service.processFileSelection(event);

      expect(result).toBeNull();
      expect(Swal.fire).toHaveBeenCalled();
      expect(input.value).toBe('');
    });
  });

  describe('uploadFiles()', () => {
    it('Debe mostrar alerta informativa cuando la lista de archivos está vacía', async () => {
      const result = await service.uploadFiles(1, [], []);

      expect(result.success).toBeFalse();
      expect(Swal.fire).toHaveBeenCalled();
    });

    it('Debe subir archivos exitosamente y retornar success true', async () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

      vehicleImageServiceSpy.createPresignedUploadUrl.and.returnValue(
        of({
          uploadUrl: 'https://s3.example.com/upload',
          key: 'img-key-123',
        } as any),
      );
      vehicleImageServiceSpy.uploadToPresignedUrl.and.returnValue(of(''));
      vehicleImageServiceSpy.confirmUpload.and.returnValue(of({} as any));

      const result = await service.uploadFiles(1, [mockFile], []);

      expect(result.success).toBeTrue();
      expect(
        vehicleImageServiceSpy.createPresignedUploadUrl,
      ).toHaveBeenCalledWith(1, 'image/jpeg');
      expect(vehicleImageServiceSpy.confirmUpload).toHaveBeenCalled();
    });

    it('Debe marcar primera imagen como primaria cuando no hay imágenes existentes', async () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

      vehicleImageServiceSpy.createPresignedUploadUrl.and.returnValue(
        of({ uploadUrl: 'https://s3.example.com/upload', key: 'key' } as any),
      );
      vehicleImageServiceSpy.uploadToPresignedUrl.and.returnValue(of(''));
      vehicleImageServiceSpy.confirmUpload.and.returnValue(of({} as any));

      await service.uploadFiles(1, [mockFile], []);

      const confirmCall = vehicleImageServiceSpy.confirmUpload.calls.first();
      expect(confirmCall.args[1].primary).toBeTrue();
    });

    it('Debe no marcar como primaria cuando ya existen imágenes', async () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const existingImages = [{ id: 1, url: 'url', primary: true }];

      vehicleImageServiceSpy.createPresignedUploadUrl.and.returnValue(
        of({ uploadUrl: 'https://s3.example.com/upload', key: 'key' } as any),
      );
      vehicleImageServiceSpy.uploadToPresignedUrl.and.returnValue(of(''));
      vehicleImageServiceSpy.confirmUpload.and.returnValue(of({} as any));

      await service.uploadFiles(1, [mockFile], existingImages);

      const confirmCall = vehicleImageServiceSpy.confirmUpload.calls.first();
      expect(confirmCall.args[1].primary).toBeFalse();
    });

    it('Debe retornar success false y mostrar error cuando falla la subida', async () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

      vehicleImageServiceSpy.createPresignedUploadUrl.and.returnValue(
        throwError(() => ({ status: 500, error: 'Internal Server Error' })),
      );

      const result = await service.uploadFiles(1, [mockFile], []);

      expect(result.success).toBeFalse();
      expect(Swal.fire).toHaveBeenCalled();
    });

    it('Debe establecer uploading en true durante la subida y false al terminar', async () => {
      const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

      vehicleImageServiceSpy.createPresignedUploadUrl.and.returnValue(
        of({ uploadUrl: 'https://s3.example.com/upload', key: 'key' } as any),
      );
      vehicleImageServiceSpy.uploadToPresignedUrl.and.returnValue(of(''));
      vehicleImageServiceSpy.confirmUpload.and.returnValue(of({} as any));

      expect(service.uploading()).toBeFalse();

      await service.uploadFiles(1, [mockFile], []);

      // Después de completarse, uploading debe ser false
      expect(service.uploading()).toBeFalse();
    });
  });

  describe('deleteImage()', () => {
    it('Debe retornar true cuando la imagen se elimina exitosamente', async () => {
      vehicleImageServiceSpy.deleteImage.and.returnValue(of(undefined as any));

      const result = await service.deleteImage(1, 10);

      expect(result).toBeTrue();
      expect(vehicleImageServiceSpy.deleteImage).toHaveBeenCalledWith(1, 10);
    });

    it('Debe retornar false y mostrar alerta cuando falla la eliminación', async () => {
      vehicleImageServiceSpy.deleteImage.and.returnValue(
        throwError(() => new Error('Delete failed')),
      );

      const result = await service.deleteImage(1, 10);

      expect(result).toBeFalse();
      expect(Swal.fire).toHaveBeenCalled();
    });
  });
});
