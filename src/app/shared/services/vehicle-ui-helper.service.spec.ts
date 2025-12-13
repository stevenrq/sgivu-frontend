import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';

import { VehicleUiHelperService } from './vehicle-ui-helper.service';
import { CarService } from '../../features/vehicles/services/car.service';
import { MotorcycleService } from '../../features/vehicles/services/motorcycle.service';
import { VehicleStatus } from '../../features/vehicles/models/vehicle-status.enum';

describe('VehicleUiHelperService', () => {
  let service: VehicleUiHelperService;
  let carService: jasmine.SpyObj<CarService>;
  let motorcycleService: jasmine.SpyObj<MotorcycleService>;

  beforeEach(() => {
    carService = jasmine.createSpyObj<CarService>('CarService', ['changeStatus']);
    motorcycleService = jasmine.createSpyObj<MotorcycleService>(
      'MotorcycleService',
      ['changeStatus'],
    );

    TestBed.configureTestingModule({
      providers: [
        VehicleUiHelperService,
        { provide: CarService, useValue: carService },
        { provide: MotorcycleService, useValue: motorcycleService },
      ],
    });

    service = TestBed.inject(VehicleUiHelperService);
  });

  it('actualiza estado de automóvil tras confirmación', fakeAsync(() => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValues(
      Promise.resolve({ isConfirmed: true } as any),
      Promise.resolve({} as any),
    );
    carService.changeStatus.and.returnValue(of(VehicleStatus.AVAILABLE));
    const onSuccess = jasmine.createSpy('onSuccess');

    service.updateCarStatus(1, VehicleStatus.AVAILABLE, onSuccess, 'AAA111');
    flushMicrotasks();

    expect(carService.changeStatus).toHaveBeenCalledWith(
      1,
      VehicleStatus.AVAILABLE,
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(swalSpy).toHaveBeenCalledTimes(2);
  }));

  it('muestra error cuando falla la actualización de moto', fakeAsync(() => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValues(
      Promise.resolve({ isConfirmed: true } as any),
      Promise.resolve({} as any),
    );
    motorcycleService.changeStatus.and.returnValue(
      throwError(() => new Error('fail')),
    );

    service.updateMotorcycleStatus(
      2,
      VehicleStatus.INACTIVE,
      () => undefined,
      'BBB222',
    );
    flushMicrotasks();

    expect(motorcycleService.changeStatus).toHaveBeenCalledWith(
      2,
      VehicleStatus.INACTIVE,
    );
    expect(swalSpy.calls.count()).toBe(2);
  }));
});
