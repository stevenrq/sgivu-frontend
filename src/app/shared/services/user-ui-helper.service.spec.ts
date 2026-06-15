import type { Mock, MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { UserUiHelperService } from './user-ui-helper.service';
import { UserService } from '../../features/users/services/user.service';
import { ToastService } from './toast.service';

describe('UserUiHelperService', () => {
  let service: UserUiHelperService;
  let userServiceSpy: MockedObject<UserService>;
  let toastServiceSpy: MockedObject<ToastService>;

  beforeEach(() => {
    userServiceSpy = {
      updateStatus: vi.fn().mockName('UserService.updateStatus'),
      delete: vi.fn().mockName('UserService.delete'),
    } as unknown as MockedObject<UserService>;
    toastServiceSpy = {
      success: vi.fn().mockName('ToastService.success'),
      error: vi.fn().mockName('ToastService.error'),
    } as unknown as MockedObject<ToastService>;

    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: userServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
    });

    service = TestBed.inject(UserUiHelperService);

    // Silenciar advertencias de Swal en la salida de prueba
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
  });

  describe('updateStatus()', () => {
    it('debe mostrar diálogo de confirmación con parámetros correctos', () => {
      const onSuccessSpy = vi.fn();

      vi.spyOn(Swal, 'fire').mockReturnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateStatus(1, true, onSuccessSpy);

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '¿Estás seguro?',
          icon: 'warning',
          showCancelButton: true,
          buttonsStyling: false,
          customClass: expect.objectContaining({
            confirmButton: 'btn btn-danger me-2',
          }),
          confirmButtonText: 'Sí',
          cancelButtonText: 'No',
        }),
      );
    });

    it('debe llamar updateStatus cuando usuario confirma', async () => {
      const onSuccessSpy = vi.fn();
      userServiceSpy.updateStatus.mockReturnValue(of({} as any));

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();
      userServiceSpy.updateStatus.mockReturnValue(of({} as any));

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();
      userServiceSpy.updateStatus.mockReturnValue(
        throwError(() => new Error('Update failed')),
      );

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();

      vi.spyOn(Swal, 'fire').mockReturnValue(
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
      const onSuccessSpy = vi.fn();

      vi.spyOn(Swal, 'fire').mockReturnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(1, onSuccessSpy);

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '¿Estás seguro?',
          text: 'Esta acción no se puede revertir.',
          icon: 'warning',
          showCancelButton: true,
          buttonsStyling: false,
          customClass: expect.objectContaining({
            confirmButton: 'btn btn-danger me-2',
          }),
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
        }),
      );
    });

    it('debe llamar delete cuando usuario confirma', async () => {
      const onSuccessSpy = vi.fn();
      userServiceSpy.delete.mockReturnValue(of({} as any));

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();
      userServiceSpy.delete.mockReturnValue(of({} as any));

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();
      userServiceSpy.delete.mockReturnValue(
        throwError(() => new Error('Delete failed')),
      );

      vi.spyOn(Swal, 'fire').mockImplementation((options: any) => {
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
      const onSuccessSpy = vi.fn();

      vi.spyOn(Swal, 'fire').mockReturnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(9, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // El servicio de confirmación usa `Swal.fire`. Si el usuario cancela,
      // no se debe ejecutar el callback de éxito.
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('debe verificar que texto de advertencia sobre irreversibilidad está presente', () => {
      const onSuccessSpy = vi.fn();

      vi.spyOn(Swal, 'fire').mockReturnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.delete(10, onSuccessSpy);

      const callArgs = vi.mocked(Swal.fire as Mock).mock.lastCall![0];
      expect(callArgs.text).toContain('Esta acción no se puede revertir');
    });
  });
});
