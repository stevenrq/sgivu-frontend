import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';
import { UserService } from '../../users/services/user.service';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';

describe('PermissionService', () => {
  let service: PermissionService;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let httpMock: HttpTestingController;

  // sujetos de autenticación controlables
  const isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  const isDoneLoadingSubject = new BehaviorSubject<boolean>(false);

  const fakeAuthService: Partial<AuthService> = {
    isAuthenticated$: isAuthenticatedSubject.asObservable(),
    isDoneLoading$: isDoneLoadingSubject.asObservable(),
    getUserId: jasmine.createSpy('getUserId').and.returnValue(null),
  };

  beforeEach(() => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['getById']);

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: AuthService, useValue: fakeAuthService },
        { provide: UserService, useValue: userServiceSpy },
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('getUserPermissions()', () => {
    it('Debe retornar Set vacío cuando no está autenticado (aun si la carga finalizó)', async () => {
      (fakeAuthService.getUserId as jasmine.Spy).and.returnValue(null);
      isAuthenticatedSubject.next(false);
      isDoneLoadingSubject.next(true);

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe retornar Set vacío cuando está autenticado pero getUserId retorna null', async () => {
      (fakeAuthService.getUserId as jasmine.Spy).and.returnValue(null);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe retornar Set vacío cuando el usuario no tiene roles/permisos', async () => {
      (fakeAuthService.getUserId as jasmine.Spy).and.returnValue(10);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const user = { id: 10, roles: [] } as any;
      userServiceSpy.getById.and.returnValue(of(user));

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe extraer permisos de los roles del usuario (deduplicando)', async () => {
      (fakeAuthService.getUserId as jasmine.Spy).and.returnValue(11);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const user = {
        id: 11,
        roles: [
          { name: 'r1', permissions: [{ name: 'p1' }, { name: 'p2' }] } as any,
          { name: 'r2', permissions: [{ name: 'p1' }] } as any,
        ],
      } as any;

      userServiceSpy.getById.and.returnValue(of(user));

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(2);
      expect(res.has('p1')).toBeTrue();
      expect(res.has('p2')).toBeTrue();
    });

    it('Debe esperar hasta que isDoneLoading sea true antes de emitir', async () => {
      (fakeAuthService.getUserId as jasmine.Spy).and.returnValue(20);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(false);

      const user = {
        id: 20,
        roles: [{ permissions: [{ name: 'perm' }] } as any],
      } as any;
      userServiceSpy.getById.and.returnValue(of(user));

      const promise = firstValueFrom(service.getUserPermissions());
      // aún no resuelto, ahora marcar 'isDoneLoading' como true
      isDoneLoadingSubject.next(true);

      const res = await promise;
      expect(res.has('perm')).toBeTrue();
    });
  });

  describe('hasPermission()', () => {
    it('Debe retornar true cuando el permiso está presente', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(
        of(new Set(['p1', 'p2'])),
      );

      const res = await firstValueFrom(service.hasPermission('p1'));
      expect(res).toBeTrue();
    });

    it('Debe retornar false cuando el permiso no está presente', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(of(new Set(['p2'])));

      const res = await firstValueFrom(service.hasPermission('p1'));
      expect(res).toBeFalse();
    });
  });

  describe('hasAnyPermission()', () => {
    it('Debe retornar true cuando algún permiso requerido está presente', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(
        of(new Set(['a', 'c'])),
      );

      const res = await firstValueFrom(service.hasAnyPermission(['x', 'a']));
      expect(res).toBeTrue();
    });

    it('Debe retornar false cuando ninguno está presente', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(of(new Set(['b'])));

      const res = await firstValueFrom(service.hasAnyPermission(['x', 'a']));
      expect(res).toBeFalse();
    });
  });

  describe('hasAllPermissions()', () => {
    it('Debe retornar true cuando todos los permisos requeridos están presentes', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(
        of(new Set(['a', 'b', 'c'])),
      );

      const res = await firstValueFrom(service.hasAllPermissions(['a', 'b']));
      expect(res).toBeTrue();
    });

    it('Debe retornar false cuando falta algún permiso requerido', async () => {
      spyOn(service, 'getUserPermissions').and.returnValue(of(new Set(['a'])));

      const res = await firstValueFrom(service.hasAllPermissions(['a', 'b']));
      expect(res).toBeFalse();
    });
  });

  describe('extractPermissionsFromUser()', () => {
    it('Debe retornar Set vacío cuando el usuario no tiene roles', () => {
      const user = { id: 1, roles: [] } as any;

      const res = (service as any).extractPermissionsFromUser(user);

      expect(res instanceof Set).toBeTrue();
      expect(res.size).toBe(0);
    });

    it('Debe extraer nombres de permisos de los roles', () => {
      const user = {
        roles: [
          { permissions: [{ name: 'p1' }, { name: 'p2' }] } as any,
          { permissions: [{ name: 'p3' }] } as any,
        ],
      } as any;

      const res = (service as any).extractPermissionsFromUser(user);

      expect(res.size).toBe(3);
      expect(res.has('p1')).toBeTrue();
      expect(res.has('p2')).toBeTrue();
      expect(res.has('p3')).toBeTrue();
    });

    it('Debe deduplicar permisos duplicados entre roles', () => {
      const user = {
        roles: [
          { permissions: [{ name: 'p1' }, { name: 'p1' }] } as any,
          { permissions: [{ name: 'p1' }, { name: 'p2' }] } as any,
        ],
      } as any;

      const res = (service as any).extractPermissionsFromUser(user);

      expect(res.size).toBe(2);
      expect(res.has('p1')).toBeTrue();
      expect(res.has('p2')).toBeTrue();
    });

    it('Debe manejar roles con arrays de permisos vacíos', () => {
      const user = {
        roles: [
          { permissions: [] } as any,
          { permissions: [{ name: 'pX' }] } as any,
        ],
      } as any;

      const res = (service as any).extractPermissionsFromUser(user);

      expect(res.size).toBe(1);
      expect(res.has('pX')).toBeTrue();
    });
  });
});
