import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UserService } from './user.service';
import { environment } from '../../../../environments/environment';
import { User } from '../models/user.model';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea usuarios y actualiza la señal de estado', () => {
    const user: User = {
      id: 1,
      nationalId: 1,
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      phoneNumber: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      roles: new Set(),
      enabled: true,
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      admin: false,
    };

    service.create(user).subscribe((created) => {
      expect(created).toEqual(user);
      expect((service as any).usersState()).toEqual([user]);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
    expect(req.request.method).toBe('POST');
    req.flush(user);
  });

  it('elimina usuarios y purga cache local', () => {
    const existing = { id: 2 } as User;
    (service as any).usersState.set([existing]);

    service.delete(existing.id!).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/v1/users/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
    expect((service as any).usersState()).toEqual([]);
  });

  it('construye filtros de búsqueda excluyendo vacíos', () => {
    service.searchUsers({
      name: 'Ada',
      role: '',
      enabled: true,
    }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/v1/users/search` &&
        request.params.get('name') === 'Ada' &&
        request.params.get('enabled') === 'true' &&
        !request.params.has('role'),
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
