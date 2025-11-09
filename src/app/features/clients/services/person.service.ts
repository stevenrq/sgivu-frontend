import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Person } from '../models/person.model.';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PersonCount } from '../interfaces/person-count.interface';

export interface PersonSearchFilters {
  name?: string;
  email?: string;
  nationalId?: string;
  phoneNumber?: string;
  enabled?: boolean | '';
  city?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PersonService {
  private readonly apiUrl = `${environment.apiUrl}/v1/persons`;

  private readonly personsState: WritableSignal<Person[]> = signal<Person[]>(
    [],
  );

  private readonly personsPagerState: WritableSignal<
    PaginatedResponse<Person>
  > = signal<PaginatedResponse<Person>>({} as PaginatedResponse<Person>);

  constructor(readonly http: HttpClient) {}

  public getPersonsState(): WritableSignal<Person[]> {
    return this.personsState;
  }

  public getPersonsPagerState(): WritableSignal<PaginatedResponse<Person>> {
    return this.personsPagerState;
  }

  public create(person: Person): Observable<Person> {
    return this.http
      .post<Person>(this.apiUrl, person)
      .pipe(
        tap((newPerson) =>
          this.personsState.update((currentPersons) => [
            ...currentPersons,
            newPerson,
          ]),
        ),
      );
  }

  public getAll(): Observable<Person[]> {
    return this.http
      .get<Person[]>(this.apiUrl)
      .pipe(tap((persons) => this.personsState.set(persons)));
  }

  public getAllPaginated(page: number): Observable<PaginatedResponse<Person>> {
    return this.http
      .get<PaginatedResponse<Person>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((paginatedResponse) =>
          this.personsPagerState.set(paginatedResponse),
        ),
      );
  }

  public getPersonCount(): Observable<PersonCount> {
    return this.http.get<PersonCount>(`${this.apiUrl}/count`);
  }

  public getById(id: number): Observable<Person> {
    return this.http.get<Person>(`${this.apiUrl}/${id}`);
  }

  public update(id: number, person: Person): Observable<Person> {
    return this.http.put<Person>(`${this.apiUrl}/${id}`, person).pipe(
      tap((updatedPerson) => {
        this.personsState.update((persons) =>
          persons.map((person) =>
            person.id === updatedPerson.id ? updatedPerson : person,
          ),
        );
      }),
    );
  }

  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

  public delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() =>
          this.personsState.update((persons) =>
            persons.filter((person) => person.id != id),
          ),
        ),
      );
  }

  public search(filters: PersonSearchFilters): Observable<Person[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return this.http.get<Person[]>(`${this.apiUrl}/search`, { params });
  }
}
