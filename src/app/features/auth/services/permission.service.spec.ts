import type { Mock, MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';
import { UserService } from '../../users/services/user.service';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';

describe('PermissionService', () => {
  let service: PermissionService;
  let userServiceSpy: MockedObject<UserService>;
  let httpMock: HttpTestingController;

  // sujetos de autenticación controlables
  const isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  const isDoneLoadingSubject = new BehaviorSubject<boolean>(false);

  const fakeAuthService: Partial<AuthService> = {
    isAuthenticated$: isAuthenticatedSubject.asObservable(),
    isDoneLoading$: isDoneLoadingSubject.asObservable(),
    getUserId: vi.fn().mockReturnValue(null),
  };

  beforeEach(() => {
    userServiceSpy = {
      getById: vi.fn().mockName('UserService.getById'),
    } as unknown as MockedObject<UserService>;

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

  describe('getAll()', () => {
    it('Debe hacer GET del catálogo y poblar el signal de permisos', () => {
      const catalog = [
        { id: 1, name: 'user:read', description: 'Ver usuarios' },
      ] as any;

      let received: any;
      service.getAll().subscribe((value) => (received = value));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/permissions`);
      expect(req.request.method).toBe('GET');
      req.flush(catalog);

      expect(received).toEqual(catalog);
      expect(service.permissions()).toEqual(catalog);
    });
  });

  describe('getUserPermissions()', () => {
    it('Debe retornar Set vacío cuando no está autenticado (aun si la carga finalizó)', async () => {
      (fakeAuthService.getUserId as Mock).mockReturnValue(null);
      isAuthenticatedSubject.next(false);
      isDoneLoadingSubject.next(true);

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe retornar Set vacío cuando está autenticado pero getUserId retorna null', async () => {
      (fakeAuthService.getUserId as Mock).mockReturnValue(null);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe retornar Set vacío cuando el usuario no tiene roles/permisos', async () => {
      (fakeAuthService.getUserId as Mock).mockReturnValue(10);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const user = { id: 10, roles: [] } as any;
      userServiceSpy.getById.mockReturnValue(of(user));

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(0);
    });

    it('Debe extraer permisos de los roles del usuario (deduplicando)', async () => {
      (fakeAuthService.getUserId as Mock).mockReturnValue(11);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(true);

      const user = {
        id: 11,
        roles: [
          { name: 'r1', permissions: [{ name: 'p1' }, { name: 'p2' }] } as any,
          { name: 'r2', permissions: [{ name: 'p1' }] } as any,
        ],
      } as any;

      userServiceSpy.getById.mockReturnValue(of(user));

      const res = await firstValueFrom(service.getUserPermissions());
      expect(res.size).toBe(2);
      expect(res.has('p1')).toBe(true);
      expect(res.has('p2')).toBe(true);
    });

    it('Debe esperar hasta que isDoneLoading sea true antes de emitir', async () => {
      (fakeAuthService.getUserId as Mock).mockReturnValue(20);
      isAuthenticatedSubject.next(true);
      isDoneLoadingSubject.next(false);

      const user = {
        id: 20,
        roles: [{ permissions: [{ name: 'perm' }] } as any],
      } as any;
      userServiceSpy.getById.mockReturnValue(of(user));

      const promise = firstValueFrom(service.getUserPermissions());
      // aún no resuelto, ahora marcar 'isDoneLoading' como true
      isDoneLoadingSubject.next(true);

      const res = await promise;
      expect(res.has('perm')).toBe(true);
    });
  });

  describe('hasPermission()', () => {
    it('Debe retornar true cuando el permiso está presente', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['p1', 'p2'])),
      );

      const res = await firstValueFrom(service.hasPermission('p1'));
      expect(res).toBe(true);
    });

    it('Debe retornar false cuando el permiso no está presente', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['p2'])),
      );

      const res = await firstValueFrom(service.hasPermission('p1'));
      expect(res).toBe(false);
    });
  });

  describe('hasAnyPermission()', () => {
    it('Debe retornar true cuando algún permiso requerido está presente', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['a', 'c'])),
      );

      const res = await firstValueFrom(service.hasAnyPermission(['x', 'a']));
      expect(res).toBe(true);
    });

    it('Debe retornar false cuando ninguno está presente', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['b'])),
      );

      const res = await firstValueFrom(service.hasAnyPermission(['x', 'a']));
      expect(res).toBe(false);
    });
  });

  describe('hasAllPermissions()', () => {
    it('Debe retornar true cuando todos los permisos requeridos están presentes', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['a', 'b', 'c'])),
      );

      const res = await firstValueFrom(service.hasAllPermissions(['a', 'b']));
      expect(res).toBe(true);
    });

    it('Debe retornar false cuando falta algún permiso requerido', async () => {
      vi.spyOn(service, 'getUserPermissions').mockReturnValue(
        of(new Set(['a'])),
      );

      const res = await firstValueFrom(service.hasAllPermissions(['a', 'b']));
      expect(res).toBe(false);
    });
  });

  describe('extractPermissionsFromUser()', () => {
    it('Debe retornar Set vacío cuando el usuario no tiene roles', () => {
      const user = { id: 1, roles: [] } as any;

      const res = (service as any).extractPermissionsFromUser(user);

      expect(res instanceof Set).toBe(true);
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
      expect(res.has('p1')).toBe(true);
      expect(res.has('p2')).toBe(true);
      expect(res.has('p3')).toBe(true);
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
      expect(res.has('p1')).toBe(true);
      expect(res.has('p2')).toBe(true);
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
      expect(res.has('pX')).toBe(true);
    });
  });
});
