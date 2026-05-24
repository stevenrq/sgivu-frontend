import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { UserService } from '../services/user.service';
import { environment } from '../../../../environments/environment';
import { User } from '../models/user.model';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      enabled: true,
      ...overrides,
    }) as User;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);

    // Reiniciar los estados internos de los signals (acceso al WritableSignal privado)
    (service as any).usersState.set([]);
    (service as any).usersPagerState.set({});
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('create()', () => {
    it('Debe hacer POST del nuevo usuario y agregarlo al estado de usuarios', () => {
      const newUser = buildUser({ id: 1, username: 'john' });

      let received: any;
      service.create(newUser).subscribe((u) => (received = u));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newUser);

      req.flush(newUser);

      expect(received).toEqual(newUser);
      const state = service.getUsersState()();
      expect(state).toContain(newUser);
    });

    it('Debe agregar al estado existente de usuarios cuando no está vacío', () => {
      const existing = [buildUser({ id: 2, username: 'jane' })] as any;
      (service as any).usersState.set(existing);

      const newUser = buildUser({ id: 3, username: 'bob' });
      service.create(newUser).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      req.flush(newUser);

      const state = service.getUsersState()();
      expect(state.length).toBe(2);
      expect(state.find((u: any) => u.id === 3)).toBeDefined();
    });

    it('Debe propagar error en falla de POST y no modificar el estado', (done) => {
      const initial = [buildUser({ id: 5 })] as any;
      (service as any).usersState.set(initial);

      service.create(buildUser({ id: 6, username: 'bad' })).subscribe({
        next: () => fail('should not succeed'),
        error: (err) => {
          expect(err).toBeDefined();
          const state = service.getUsersState()();
          expect(state).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('getAll()', () => {
    it('Debe hacer GET de todos los usuarios y establecer el estado de usuarios', () => {
      const mock = [
        buildUser({ id: 1, username: 'alice' }),
        buildUser({ id: 2, username: 'bob' }),
      ] as any[];

      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getUsersState()()).toEqual(mock);
    });

    it('Debe manejar respuesta con lista vacía', () => {
      let received: any[] | undefined;
      service.getAll().subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      req.flush([]);

      expect(received).toEqual([]);
      expect(service.getUsersState()()).toEqual([]);
    });
  });

  describe('getAllPaginated()', () => {
    it('Debe hacer GET de usuarios paginados y establecer el estado del paginador', () => {
      const mock = {
        page: 2,
        content: [buildUser({ id: 3, username: 'charlie' })],
      } as any;

      let received: any;
      service.getAllPaginated(2).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/page/2`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getUsersState()()).toContain(mock.content[0]);
      expect(service.getUsersPagerState()()).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 1, content: [] } as any;

      let received: any;
      service.getAllPaginated(1).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/page/1`);
      req.flush(mock);

      expect(received).toEqual(mock);
      expect(service.getUsersPagerState()()).toEqual(mock);
    });
  });

  describe('update()', () => {
    it('Debe hacer PUT del usuario actualizado y actualizar el estado de usuarios', () => {
      const initial = [
        buildUser({ id: 1, username: 'old' }),
        buildUser({ id: 2, username: 'keep' }),
      ];
      (service as any).usersState.set(initial);

      const updated = buildUser({ id: 1, username: 'new' });

      let received: any;
      service.update(1, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getUsersState()();
      const found = state.find((u: any) => u.id === 1);
      expect(found).toBeDefined();
      expect((found as any).username).toBe('new');
      expect(state.length).toBe(2);
    });

    it('Debe no alterar el estado al actualizar un usuario inexistente', () => {
      const initial = [buildUser({ id: 2, username: 'keep' })] as any;
      (service as any).usersState.set(initial);

      const updated = buildUser({ id: 99, username: 'ghost' });

      let received: any;
      service.update(99, updated).subscribe((v) => (received = v));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/99`);
      req.flush(updated);

      expect(received).toEqual(updated);
      const state = service.getUsersState()();
      expect(state).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [buildUser({ id: 1, username: 'old' })] as any;
      (service as any).usersState.set(initial);

      service.update(1, buildUser({ id: 1, username: 'new' })).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getUsersState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('delete()', () => {
    it('Debe hacer DELETE del usuario y eliminarlo del estado de usuarios', () => {
      const initial = [
        buildUser({ id: 1, username: 'alice' }),
        buildUser({ id: 2, username: 'bob' }),
      ];
      (service as any).usersState.set(initial);

      let done = false;
      service.delete(1).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      const state = service.getUsersState()();
      expect(state.find((u: any) => u.id === 1)).toBeUndefined();
      expect(state.length).toBe(1);
    });

    it('Debe dejar el estado sin cambios al eliminar un id inexistente', () => {
      const initial = [buildUser({ id: 2, username: 'bob' })] as any;
      (service as any).usersState.set(initial);

      let done = false;
      service.delete(3).subscribe(() => (done = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBeTrue();
      expect(service.getUsersState()()).toEqual(initial);
    });

    it('Debe no cambiar el estado ante error del servidor', (done) => {
      const initial = [buildUser({ id: 1, username: 'alice' })] as any;
      (service as any).usersState.set(initial);

      service.delete(1).subscribe({
        next: () => fail('should error'),
        error: () => {
          expect(service.getUsersState()()).toEqual(initial);
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/1`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('searchUsers()', () => {
    it('Debe hacer GET de usuarios que coincidan con los filtros', () => {
      const mock = [
        buildUser({ id: 1, username: 'alice', email: 'alice@example.com' }),
      ] as any[];

      let received: any[] | undefined;
      service
        .searchUsers({ username: 'alice', email: 'alice@example.com' })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/users/search` &&
          request.params.get('username') === 'alice' &&
          request.params.get('email') === 'alice@example.com'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe excluir valores de filtro null y undefined', () => {
      const mock = [] as any[];

      let received: any[] | undefined;
      service
        .searchUsers({
          username: 'john',
          email: undefined,
          role: '',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/users/search` &&
          params.get('username') === 'john' &&
          params.get('email') === null &&
          params.get('role') === null
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe incluir filtro booleano enabled como string', () => {
      const mock = [] as any[];

      let received: any[] | undefined;
      service.searchUsers({ enabled: true }).subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/users/search` &&
          request.params.get('enabled') === 'true'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar resultados de búsqueda vacíos', () => {
      let received: any[] | undefined;
      service
        .searchUsers({ username: 'notfound' })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne(
        `${environment.apiUrl}/v1/users/search?username=notfound`,
      );
      req.flush([]);

      expect(received).toEqual([]);
    });
  });

  describe('searchUsersPaginated()', () => {
    it('Debe hacer GET de usuarios paginados que coincidan con los filtros', () => {
      const mock = {
        page: 1,
        content: [buildUser({ id: 1, username: 'alice' })],
      } as any;

      let received: any;
      service
        .searchUsersPaginated(1, { username: 'alice' })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/users/search/page/1` &&
          request.params.get('username') === 'alice'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe excluir filtros null y undefined en búsqueda paginada', () => {
      const mock = { page: 0, content: [] } as any;

      let received: any;
      service
        .searchUsersPaginated(0, {
          username: 'john',
          email: undefined,
          enabled: '',
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/users/search/page/0` &&
          params.get('username') === 'john' &&
          params.get('email') === null &&
          params.get('role') === null &&
          params.get('enabled') === null
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });

    it('Debe manejar resultados de página vacíos', () => {
      const mock = { page: 5, content: [] } as any;

      let received: any;
      service
        .searchUsersPaginated(5, { enabled: false })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${environment.apiUrl}/v1/users/search/page/5` &&
          request.params.get('enabled') === 'false'
        );
      });

      req.flush(mock);

      expect(received.content.length).toBe(0);
    });

    it('Debe incluir múltiples filtros en búsqueda paginada', () => {
      const mock = { page: 2, content: [] } as any;

      let received: any;
      service
        .searchUsersPaginated(2, {
          name: 'John Doe',
          username: 'johndoe',
          email: 'john@example.com',
          role: 'ADMIN',
          enabled: true,
        })
        .subscribe((v) => (received = v));

      const req = httpMock.expectOne((request) => {
        const params = request.params;
        return (
          request.url === `${environment.apiUrl}/v1/users/search/page/2` &&
          params.get('name') === 'John Doe' &&
          params.get('username') === 'johndoe' &&
          params.get('email') === 'john@example.com' &&
          params.get('role') === 'ADMIN' &&
          params.get('enabled') === 'true'
        );
      });

      req.flush(mock);

      expect(received).toEqual(mock);
    });
  });
});
