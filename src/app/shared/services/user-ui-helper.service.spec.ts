import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

import { UserUiHelperService } from './user-ui-helper.service';
import { UserService } from '../../features/users/services/user.service';

describe('UserUiHelperService', () => {
  let service: UserUiHelperService;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    userService = jasmine.createSpyObj<UserService>('UserService', [
      'updateStatus',
      'delete',
    ]);
    TestBed.configureTestingModule({
      providers: [
        UserUiHelperService,
        { provide: UserService, useValue: userService },
      ],
    });
    service = TestBed.inject(UserUiHelperService);
  });

  it('actualiza estado tras confirmación y notifica éxito', fakeAsync(() => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValues(
      Promise.resolve({ isConfirmed: true } as any),
      Promise.resolve({} as any),
    );
    userService.updateStatus.and.returnValue(of(true));
    const onSuccess = jasmine.createSpy('onSuccess');

    service.updateStatus(1, true, onSuccess);
    flushMicrotasks();

    expect(userService.updateStatus).toHaveBeenCalledWith(1, true);
    expect(onSuccess).toHaveBeenCalled();
    expect(swalSpy).toHaveBeenCalledTimes(2);
  }));

  it('no llama al servicio si el usuario cancela', fakeAsync(() => {
    spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({ isConfirmed: false } as any),
    );

    service.delete(1, () => undefined);
    flushMicrotasks();

    expect(userService.delete).not.toHaveBeenCalled();
  }));
});
