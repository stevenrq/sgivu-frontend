import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientUiHelperService } from './client-ui-helper.service';
import { PersonService } from '../../features/clients/services/person.service';
import { CompanyService } from '../../features/clients/services/company.service';

describe('ClientUiHelperService', () => {
  let service: ClientUiHelperService;
  let personService: jasmine.SpyObj<PersonService>;
  let companyService: jasmine.SpyObj<CompanyService>;

  beforeEach(() => {
    personService = jasmine.createSpyObj<PersonService>('PersonService', [
      'updateStatus',
    ]);
    companyService = jasmine.createSpyObj<CompanyService>('CompanyService', [
      'updateStatus',
    ]);

    TestBed.configureTestingModule({
      providers: [
        ClientUiHelperService,
        { provide: PersonService, useValue: personService },
        { provide: CompanyService, useValue: companyService },
      ],
    });

    service = TestBed.inject(ClientUiHelperService);
  });

  it('confirma y actualiza estado de persona invocando callback', fakeAsync(() => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValues(
      Promise.resolve({ isConfirmed: true } as any),
      Promise.resolve({} as any),
    );
    personService.updateStatus.and.returnValue(of(true));
    const onSuccess = jasmine.createSpy('onSuccess');

    service.updatePersonStatus(1, true, onSuccess, 'Cliente');
    flushMicrotasks();

    expect(personService.updateStatus).toHaveBeenCalledWith(1, true);
    expect(onSuccess).toHaveBeenCalled();
    expect(swalSpy).toHaveBeenCalledTimes(2);
  }));

  it('muestra alerta de error cuando la actualización falla', fakeAsync(() => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValues(
      Promise.resolve({ isConfirmed: true } as any),
      Promise.resolve({} as any),
    );
    companyService.updateStatus.and.returnValue(throwError(() => new Error()));

    service.updateCompanyStatus(5, false, () => undefined, 'Empresa');
    flushMicrotasks();

    expect(companyService.updateStatus).toHaveBeenCalledWith(5, false);
    // Se invoca 2 veces: confirmación + error
    expect(swalSpy.calls.count()).toBe(2);
  }));
});
