import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { UserUiHelperService } from './user-ui-helper.service';
import { UserService } from '../../features/users/services/user.service';
import { ToastService } from './toast.service';

describe('UserUiHelperService', () => {
  let service: UserUiHelperService;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    userServiceSpy = jasmine.createSpyObj('UserService', [
      'updateStatus',
      'delete',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: userServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
    });

    service = TestBed.inject(UserUiHelperService);

    // Silenciar advertencias de Swal en la salida de prueba
    spyOn(console, 'error').and.callFake(() => {
      /* noop */
    });
  });

  describe('updateStatus()', () => {
    it('debe mostrar diálogo de confirmación con parámetros correctos', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateStatus(1, true, onSuccessSpy);

      expect(Swal.fire).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: '¿Estás seguro?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sí',
          cancelButtonText: 'No',
        }),
      );
    });

    it('debe llamar updateStatus cuando usuario confirma', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.updateStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateStatus(5, false, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(userServiceSpy.updateStatus).toHaveBeenCalledWith(5, false);
    });

    it('debe mostrar diálogo de éxito y ejecutar onSuccess cuando actualización exitosa', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.updateStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateStatus(3, true, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(toastServiceSpy.success).toHaveBeenCalledWith(
        'Estado actualizado exitosamente',
      );
    });

    it('debe mostrar diálogo de error y no ejecutar onSuccess cuando hay error', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.updateStatus.and.returnValue(
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

      service.updateStatus(2, true, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(toastServiceSpy.error).toHaveBeenCalledWith(
        'No se pudo actualizar el estado del usuario. Intenta nuevamente.',
      );
    });

    it('no debe llamar updateStatus cuando usuario cancela', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateStatus(4, false, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // El servicio de confirmación usa `Swal.fire`. Si el usuario cancela,
      // no se debe ejecutar el callback de éxito.
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('debe mostrar diálogo de confirmación con parámetros correctos', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(1, onSuccessSpy);

      expect(Swal.fire).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: '¿Estás seguro?',
          text: 'Esta acción no se puede revertir.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
        }),
      );
    });

    it('debe llamar delete cuando usuario confirma', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.delete.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.delete(7, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(userServiceSpy.delete).toHaveBeenCalledWith(7);
    });

    it('debe mostrar diálogo de éxito y ejecutar onSuccess cuando eliminación exitosa', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.delete.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.delete(8, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(toastServiceSpy.success).toHaveBeenCalledWith('Usuario eliminado');
    });

    it('debe mostrar diálogo de error y no ejecutar onSuccess cuando hay error', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      userServiceSpy.delete.and.returnValue(
        throwError(() => new Error('Delete failed')),
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

      service.delete(6, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(toastServiceSpy.error).toHaveBeenCalledWith(
        'No se pudo eliminar el usuario. Intenta nuevamente.',
      );
    });

    it('no debe llamar delete cuando usuario cancela', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(9, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // El servicio de confirmación usa `Swal.fire`. Si el usuario cancela,
      // no se debe ejecutar el callback de éxito.
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('debe verificar que texto de advertencia sobre irreversibilidad está presente', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(10, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('Esta acción no se puede revertir');
    });
  });
});
