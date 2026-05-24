import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RoleService } from './role.service';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/role.model';

describe('RoleService', () => {
  let service: RoleService;
  let httpMock: HttpTestingController;

  const buildRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: 1,
      name: 'ADMIN',
      description: 'Administrador',
      permissions: new Set(),
      ...overrides,
    }) as Role;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(RoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('findAll()', () => {
    it('Debe hacer GET de todos los roles', () => {
      const mockRoles = [
        buildRole({ id: 1, name: 'ADMIN' }),
        buildRole({ id: 2, name: 'USER' }),
      ] as any;

      let received: any;
      service.findAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/roles`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRoles);

      expect(received).toEqual(mockRoles);
    });

    it('Debe manejar respuesta con lista vacía', () => {
      let received: any;
      service.findAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/roles`);
      req.flush([]);

      expect(received).toEqual([]);
    });
  });

  describe('addPermissions()', () => {
    it('Debe hacer POST para agregar permisos al rol', () => {
      const permissions = ['user:read', 'user:write'];
      const updatedRole = buildRole({
        id: 1,
        name: 'ADMIN',
      });

      let received: any;
      service.addPermissions(1, permissions).subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/1/add-permissions`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(permissions);
      req.flush(updatedRole);

      expect(received).toEqual(updatedRole);
    });

    it('Debe propagar error en falla de POST', (done) => {
      service.addPermissions(1, ['perm']).subscribe({
        next: () => fail('No debería tener éxito'),
        error: (err) => {
          expect(err).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/1/add-permissions`,
      );
      req.error(new ProgressEvent('error'));
    });
  });

  describe('updatePermissions()', () => {
    it('Debe hacer PUT para actualizar permisos del rol', () => {
      const permissions = ['vehicle:read'];
      const updatedRole = buildRole({ id: 2, name: 'USER' });

      let received: any;
      service
        .updatePermissions(2, permissions)
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/2/permissions`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(permissions);
      req.flush(updatedRole);

      expect(received).toEqual(updatedRole);
    });

    it('Debe propagar error en falla de PUT', (done) => {
      service.updatePermissions(2, ['perm']).subscribe({
        next: () => fail('No debería tener éxito'),
        error: (err) => {
          expect(err).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/2/permissions`,
      );
      req.error(new ProgressEvent('error'));
    });
  });

  describe('removePermissions()', () => {
    it('Debe hacer DELETE para remover permisos del rol', () => {
      const permissions = ['user:delete'];
      const updatedRole = buildRole({ id: 1, name: 'ADMIN' });

      let received: any;
      service
        .removePermissions(1, permissions)
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/1/remove-permissions`,
      );
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual(permissions);
      req.flush(updatedRole);

      expect(received).toEqual(updatedRole);
    });

    it('Debe propagar error en falla de DELETE', (done) => {
      service.removePermissions(1, ['perm']).subscribe({
        next: () => fail('No debería tener éxito'),
        error: (err) => {
          expect(err).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/roles/1/remove-permissions`,
      );
      req.error(new ProgressEvent('error'));
    });
  });
});
