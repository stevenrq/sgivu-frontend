import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { VehicleUiHelperService } from './vehicle-ui-helper.service';
import { CarService } from '../../features/vehicles/services/car.service';
import { MotorcycleService } from '../../features/vehicles/services/motorcycle.service';
import { VehicleStatus } from '../../features/vehicles/models/vehicle-status.enum';
import { ToastService } from './toast.service';

describe('VehicleUiHelperService', () => {
  let service: VehicleUiHelperService;
  let carServiceSpy: jasmine.SpyObj<CarService>;
  let motorcycleServiceSpy: jasmine.SpyObj<MotorcycleService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    carServiceSpy = jasmine.createSpyObj('CarService', ['changeStatus']);
    motorcycleServiceSpy = jasmine.createSpyObj('MotorcycleService', [
      'changeStatus',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: CarService, useValue: carServiceSpy },
        { provide: MotorcycleService, useValue: motorcycleServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
    });

    service = TestBed.inject(VehicleUiHelperService);

    // Silenciar advertencias de Swal en la salida de prueba
    spyOn(console, 'error').and.callFake(() => {
      /* noop */
    });
  });

  describe('updateCarStatus()', () => {
    beforeEach(() => {
      carServiceSpy.changeStatus.calls.reset();
    });

    it('debe generar descripción sin plate: "el automóvil seleccionado"', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(1, VehicleStatus.AVAILABLE, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('el automóvil seleccionado');
    });

    it('debe generar descripción con plate: "el automóvil con placa XYZ"', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(
        2,
        VehicleStatus.AVAILABLE,
        onSuccessSpy,
        'ABC-123',
      );

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('el automóvil con placa ABC-123');
    });

    it('debe mostrar diálogo de confirmación con parámetros correctos', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(
        1,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'XYZ-789',
      );

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

    it('debe llamar carService.changeStatus cuando usuario confirma', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateCarStatus(5, VehicleStatus.AVAILABLE, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(carServiceSpy.changeStatus).toHaveBeenCalledWith(
        5,
        VehicleStatus.AVAILABLE,
      );
    });

    it('debe mostrar diálogo de éxito y ejecutar onSuccess cuando confirmación exitosa', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateCarStatus(
        3,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'DEF-456',
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(toastServiceSpy.success).toHaveBeenCalledWith(
        'Estado actualizado con éxito',
      );
    });

    it('debe mostrar diálogo de error y no ejecutar onSuccess cuando hay error', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(
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

      service.updateCarStatus(4, VehicleStatus.AVAILABLE, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(toastServiceSpy.error).toHaveBeenCalledWith(
        'No se pudo actualizar el estado del vehículo. Intenta nuevamente.',
      );
    });

    it('no debe llamar changeStatus ni ejecutar onSuccess cuando usuario cancela', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(
        6,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'GHI-789',
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Si cancela, onSuccess no debe ejecutarse
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateMotorcycleStatus()', () => {
    beforeEach(() => {
      motorcycleServiceSpy.changeStatus.calls.reset();
    });

    it('debe generar descripción sin plate: "la motocicleta seleccionada"', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateMotorcycleStatus(1, VehicleStatus.AVAILABLE, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('la motocicleta seleccionada');
    });

    it('debe generar descripción con plate: "la motocicleta con placa XYZ"', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateMotorcycleStatus(
        2,
        VehicleStatus.AVAILABLE,
        onSuccessSpy,
        'MTO-999',
      );

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('la motocicleta con placa MTO-999');
    });

    it('debe mostrar diálogo de confirmación con parámetros correctos', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateMotorcycleStatus(
        1,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'MTR-111',
      );

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

    it('debe llamar motorcycleService.changeStatus cuando usuario confirma', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateMotorcycleStatus(7, VehicleStatus.AVAILABLE, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(motorcycleServiceSpy.changeStatus).toHaveBeenCalledWith(
        7,
        VehicleStatus.AVAILABLE,
      );
    });

    it('debe mostrar diálogo de éxito y ejecutar onSuccess cuando confirmación exitosa', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.callFake((options: any) => {
        if (options.title === '¿Estás seguro?') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        if (options.icon === 'success') {
          return Promise.resolve({ isConfirmed: true } as any);
        }
        return Promise.resolve({ isConfirmed: false } as any);
      });

      service.updateMotorcycleStatus(
        8,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'MTC-222',
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(toastServiceSpy.success).toHaveBeenCalledWith(
        'Estado actualizado con éxito',
      );
    });

    it('debe mostrar diálogo de error y no ejecutar onSuccess cuando hay error', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      motorcycleServiceSpy.changeStatus.and.returnValue(
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

      service.updateMotorcycleStatus(9, VehicleStatus.AVAILABLE, onSuccessSpy);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(toastServiceSpy.error).toHaveBeenCalledWith(
        'No se pudo actualizar el estado del vehículo. Intenta nuevamente.',
      );
    });

    it('no debe llamar changeStatus ni ejecutar onSuccess cuando usuario cancela', async () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateMotorcycleStatus(
        10,
        VehicleStatus.INACTIVE,
        onSuccessSpy,
        'MTH-333',
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Si cancela, onSuccess no debe ejecutarse
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });
  });

  describe('describeAction()', () => {
    it('debe retornar "desactivar" para VehicleStatus.INACTIVE', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(1, VehicleStatus.INACTIVE, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('Se desactivará');
    });

    it('debe retornar "activar" para VehicleStatus.AVAILABLE', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(1, VehicleStatus.AVAILABLE, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('Se activará');
    });

    it('debe retornar "actualizar" para otros estados', () => {
      const onSuccessSpy = jasmine.createSpy('onSuccess');
      carServiceSpy.changeStatus.and.returnValue(of({} as any));

      spyOn(Swal, 'fire').and.returnValue(
        Promise.resolve({ isConfirmed: false } as any),
      );

      service.updateCarStatus(1, VehicleStatus.IN_MAINTENANCE, onSuccessSpy);

      const callArgs = (Swal.fire as jasmine.Spy).calls.mostRecent().args[0];
      expect(callArgs.text).toContain('Se actualizará');
    });
  });
});
