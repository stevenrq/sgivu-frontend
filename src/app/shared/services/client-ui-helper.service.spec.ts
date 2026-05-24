import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { ClientUiHelperService } from './client-ui-helper.service';
import { PersonService } from '../../features/clients/services/person.service';
import { CompanyService } from '../../features/clients/services/company.service';

describe('ClientUiHelperService', () => {
  let service: ClientUiHelperService;
  let personServiceSpy: jasmine.SpyObj<PersonService>;
  let companyServiceSpy: jasmine.SpyObj<CompanyService>;

  beforeEach(() => {
    personServiceSpy = jasmine.createSpyObj('PersonService', ['updateStatus']);
    companyServiceSpy = jasmine.createSpyObj('CompanyService', [
      'updateStatus',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: PersonService, useValue: personServiceSpy },
        { provide: CompanyService, useValue: companyServiceSpy },
      ],
    });

    service = TestBed.inject(ClientUiHelperService);

    // Silenciar advertencias de Swal en la salida de prueba
    spyOn(console, 'error').and.callFake(() => {
      /* noop */
    });
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('updatePersonStatus()', () => {
    it('Debe mostrar diálogo de confirmación y actualizar estado de persona al confirmar', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      personServiceSpy.updateStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updatePersonStatus(1, true, onSuccessSpy, 'Juan Pérez');

      // Esperar operaciones asincrónicas
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(personServiceSpy.updateStatus).toHaveBeenCalledWith(1, true);
      expect(onSuccessSpy).toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledTimes(2); // confirmación + éxito
    });

    it('Debe mostrar diálogo de error cuando falla la actualización de estado de persona', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      personServiceSpy.updateStatus.and.returnValue(
        throwError(() => new Error('Update failed')),
      );

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'error') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updatePersonStatus(2, true, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(personServiceSpy.updateStatus).toHaveBeenCalledWith(2, true);
      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledTimes(2); // confirmación + error
    });

    it('Debe usar descripción por defecto cuando no se proporciona personName', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      personServiceSpy.updateStatus.and.returnValue(of({} as any));

      let capturedOptions: any;
      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          capturedOptions = options;
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: true } as any);
      });

      service.updatePersonStatus(3, true, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(capturedOptions.text).toContain('el cliente persona');
      expect(personServiceSpy.updateStatus).toHaveBeenCalledWith(3, true);
    });

    it('Debe usar texto de acción correcto al activar (nextStatus=true)', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      personServiceSpy.updateStatus.and.returnValue(of({} as any));

      let capturedOptions: any;
      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          capturedOptions = options;
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: true } as any);
      });

      service.updatePersonStatus(1, true, onSuccessSpy, 'Test Person');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(capturedOptions.text).toContain('activará');
    });
  });

  describe('updateCompanyStatus()', () => {
    it('Debe mostrar diálogo de confirmación y actualizar estado de empresa al confirmar', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      companyServiceSpy.updateStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateCompanyStatus(1, true, onSuccessSpy, 'ACME Corp');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(companyServiceSpy.updateStatus).toHaveBeenCalledWith(1, true);
      expect(onSuccessSpy).toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledTimes(2); // confirmación + éxito
    });

    it('Debe mostrar diálogo de error cuando falla la actualización de estado de empresa', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      companyServiceSpy.updateStatus.and.returnValue(
        throwError(() => new Error('Update failed')),
      );

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'error') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateCompanyStatus(2, false, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(companyServiceSpy.updateStatus).toHaveBeenCalledWith(2, false);
      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledTimes(2); // confirmación + error
    });

    it('Debe usar descripción por defecto cuando no se proporciona companyName', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      companyServiceSpy.updateStatus.and.returnValue(of({} as any));

      let capturedOptions: any;
      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          capturedOptions = options;
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: true } as any);
      });

      service.updateCompanyStatus(3, true, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(capturedOptions.text).toContain('la empresa');
      expect(companyServiceSpy.updateStatus).toHaveBeenCalledWith(3, true);
    });

    it('Debe usar texto de acción correcto al desactivar (nextStatus=false)', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      companyServiceSpy.updateStatus.and.returnValue(of({} as any));

      let capturedOptions: any;
      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          capturedOptions = options;
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: true } as any);
      });

      service.updateCompanyStatus(2, false, onSuccessSpy, 'OldCompany');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(capturedOptions.text).toContain('desactivará');
    });
  });
});
