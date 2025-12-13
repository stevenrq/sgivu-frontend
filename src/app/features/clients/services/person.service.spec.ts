import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PersonService } from './person.service';
import { environment } from '../../../../environments/environment';
import { Person } from '../models/person.model.';

describe('PersonService', () => {
  let service: PersonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PersonService],
    });
    service = TestBed.inject(PersonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea personas y sincroniza el estado en memoria', () => {
    const payload: Person = {
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      nationalId: 123,
      email: 'a@example.com',
      phoneNumber: '1',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      enabled: true,
    };

    service.create(payload).subscribe((person) => {
      expect(person).toEqual(payload);
      expect((service as any).personsState()).toEqual([payload]);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons`);
    expect(req.request.method).toBe('POST');
    req.flush(payload);
  });

  it('borra personas y purga la cache local', () => {
    const existing: Person = {
      id: 4,
      firstName: 'Grace',
      lastName: 'Hopper',
      nationalId: 456,
      email: 'g@example.com',
      phoneNumber: '1',
      address: { street: 'Main', number: '1', city: 'Bogotá' },
      enabled: true,
    };
    (service as any).personsState.set([existing]);

    service.delete(existing.id!).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/persons/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
    expect((service as any).personsState()).toEqual([]);
  });

  it('construye params de búsqueda omitiendo filtros vacíos', () => {
    service.search({
      name: 'Ada',
      email: '',
      nationalId: undefined,
      enabled: 'true',
    }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/v1/persons/search` &&
        request.params.has('name') &&
        request.params.get('name') === 'Ada' &&
        request.params.get('enabled') === 'true' &&
        !request.params.has('email'),
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
