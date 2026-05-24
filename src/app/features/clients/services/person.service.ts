import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Person } from '../models/person.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PersonCount } from '../interfaces/person-count.interface';
import {
  CrudOperations,
  createCrudOperations,
} from '../../../shared/utils/crud-operations.factory';

/** Filtros de búsqueda disponibles para el endpoint de personas cliente. */
export interface PersonSearchFilters {
  name?: string;
  email?: string;
  nationalId?: string;
  phoneNumber?: string;
  enabled?: boolean | '' | 'true' | 'false';
  city?: string;
}

/**
 * Servicio de gestión de clientes persona natural.
 * Delega las operaciones CRUD a `createCrudOperations` y expone
 * el estado como Signals de solo lectura.
 */
@Injectable({
  providedIn: 'root',
})
export class PersonService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/persons`;

  private readonly crud: CrudOperations<
    Person,
    PersonSearchFilters,
    PersonCount
  > = createCrudOperations<
    Person,
    PersonSearchFilters,
    PersonCount,
    PersonCount
  >({
    http: this.http,
    apiUrl: this.apiUrl,
  });

  readonly state = this.crud.state;
  readonly pagerState = this.crud.pagerState;

  getPersonsState = () => this.crud._writableState;
  getPersonsPagerState = () => this.crud.pagerState;

  create = (person: Person) => this.crud.create(person);
  getAll = () => this.crud.getAll();
  getAllPaginated = (page: number) => this.crud.getAllPaginated(page);
  getPersonCount = () => this.crud.getCounts();
  getById = (id: number) => this.crud.getById(id);
  update = (id: number, person: Person) => this.crud.update(id, person);
  delete = (id: number) => this.crud.delete(id);
  search = (filters: PersonSearchFilters) => this.crud.search(filters);
  searchPaginated = (page: number, filters: PersonSearchFilters) =>
    this.crud.searchPaginated(page, filters);

  /**
   * Actualiza el estado activo/inactivo de una persona cliente.
   *
   * @param id - Identificador de la persona.
   * @param status - Nuevo estado (`true` = activo, `false` = inactivo).
   * @returns Observable con el nuevo estado.
   */
  updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }
}
