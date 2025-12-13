import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';
import { UserService } from '../../users/services/user.service';
import { environment } from '../../../../environments/environment';
import { User } from '../../users/models/user.model';

describe('PermissionService', () => {
  let service: PermissionService;
  let httpMock: HttpTestingController;
  let authState$: BehaviorSubject<boolean>;
  let doneLoading$: BehaviorSubject<boolean>;
  let authService: jasmine.SpyObj<AuthService>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    authState$ = new BehaviorSubject<boolean>(false);
    doneLoading$ = new BehaviorSubject<boolean>(false);

    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getUserId',
    ], {
      isAuthenticated$: authState$.asObservable(),
      isDoneLoading$: doneLoading$.asObservable(),
    });
    userService = jasmine.createSpyObj<UserService>('UserService', ['getById']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PermissionService,
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
      ],
    });

    service = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('obtiene y almacena permisos desde el backend', () => {
    const permissions = [{ id: 1, name: 'user:create', description: 'Create users' }];

    service.getAll().subscribe((response) => {
      expect(response).toEqual(permissions);
      expect((service as any).permissionsState()).toEqual(permissions);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/permissions`);
    expect(req.request.method).toBe('GET');
    req.flush(permissions);
  });

  it('construye el set de permisos del usuario autenticado', (done) => {
    const user: User = {
      id: 10,
      nationalId: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      phoneNumber: 123,
      username: 'ada',
      email: 'ada@example.com',
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      admin: false,
      enabled: true,
      roles: new Set([
        {
          id: 1,
          name: 'ADMIN',
          description: '',
          permissions: new Set([
            { id: 1, name: 'user:create', description: 'Create users' } as any,
          ]),
        } as any,
      ]),
    };
    authService.getUserId.and.returnValue(user.id);
    userService.getById.and.returnValue(of(user));

    authState$.next(true);
    doneLoading$.next(true);

    service.getUserPermissions().subscribe((set) => {
      expect(set.has('user:create')).toBeTrue();
      expect(set.size).toBe(1);
      done();
    });
  });

  it('hasAnyPermission retorna true si alguno coincide', (done) => {
    spyOn(service, 'getUserPermissions').and.returnValue(
      of(new Set(['vehicle:read', 'user:update'])),
    );

    service.hasAnyPermission(['unknown', 'user:update']).subscribe((hasAny) => {
      expect(hasAny).toBeTrue();
      done();
    });
  });
});
