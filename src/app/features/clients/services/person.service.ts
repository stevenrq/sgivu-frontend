import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Person } from '../models/person.model.';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PersonCount } from '../interfaces/person-count.interface';

/**
 * @description Conjunto de filtros soportados por la API para localizar personas (clientes naturales) en SGIVU.
 */
export interface PersonSearchFilters {
  name?: string;
  email?: string;
  nationalId?: string;
  phoneNumber?: string;
  enabled?: boolean | '' | 'true' | 'false';
  city?: string;
}

/**
 * @description Servicio de clientes tipo persona. Sincroniza estado local para listados, KPIs y formularios de edición sin volver a pedir la API.
 */
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

  /**
   * @description Expone la señal reactiva con los clientes en memoria para compartir entre componentes.
   * @returns Señal escribible de personas.
   */
  public getPersonsState(): WritableSignal<Person[]> {
    return this.personsState;
  }

  /**
   * @description Exposición del último paginador usado para mantener navegación consistente.
   * @returns Señal con la respuesta paginada.
   */
  public getPersonsPagerState(): WritableSignal<PaginatedResponse<Person>> {
    return this.personsPagerState;
  }

  /**
   * @description Registra un nuevo cliente natural y agrega el resultado al estado local.
   * @param person Datos a persistir.
   * @returns Observable con la entidad creada.
   */
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

  /**
   * @description Recupera todas las personas para catálogos y sincroniza el store interno.
   * @returns Observable con la colección completa.
   */
  public getAll(): Observable<Person[]> {
    return this.http
      .get<Person[]>(this.apiUrl)
      .pipe(tap((persons) => this.personsState.set(persons)));
  }

  /**
   * @description Trae una página de clientes naturales y actualiza la metadata de paginación.
   * @param page Número de página (cero-based).
   * @returns Observable con la página solicitada.
   */
  public getAllPaginated(page: number): Observable<PaginatedResponse<Person>> {
    return this.http
      .get<PaginatedResponse<Person>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((paginatedResponse) =>
          this.personsPagerState.set(paginatedResponse),
        ),
      );
  }

  /**
   * @description Consulta contadores de clientes (activos/inactivos) para mostrar KPIs en paneles.
   * @returns Observable con métricas de personas.
   */
  public getPersonCount(): Observable<PersonCount> {
    return this.http.get<PersonCount>(`${this.apiUrl}/count`);
  }

  /**
   * @description Obtiene una persona concreta para vista detalle o edición.
   * @param id Identificador del cliente.
   * @returns Observable con la persona encontrada.
   */
  public getById(id: number): Observable<Person> {
    return this.http.get<Person>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Actualiza la información de un cliente y sincroniza el estado local para reflejar cambios en listas.
   * @param id Identificador del cliente.
   * @param person Datos nuevos.
   * @returns Observable con la entidad actualizada.
   */
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

  /**
   * @description Cambia el estado activo de un cliente; se usa en bloqueos o reactivaciones.
   * @param id Identificador del cliente.
   * @param status Estado solicitado.
   * @returns Observable con el estado final.
   */
  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

  /**
   * @description Elimina al cliente y remueve su referencia en memoria para que las vistas no muestren registros obsoletos.
   * @param id Identificador del cliente.
   * @returns Observable vacío al finalizar.
   */
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

  /**
   * @description Ejecuta búsquedas sin paginar combinando múltiples filtros (ciudad, identificación, estado, etc.).
   * @param filters Filtros de búsqueda; campos vacíos se omiten.
   * @returns Observable con resultados filtrados.
   */
  public search(filters: PersonSearchFilters): Observable<Person[]> {
    const params = this.buildSearchParams(filters);
    return this.http.get<Person[]>(`${this.apiUrl}/search`, { params });
  }

  /**
   * @description Variante paginada de la búsqueda de clientes, útil para listados extensos con filtros activos.
   * @param page Página solicitada.
   * @param filters Filtros de búsqueda.
   * @returns Observable con la página filtrada.
   */
  public searchPaginated(
    page: number,
    filters: PersonSearchFilters,
  ): Observable<PaginatedResponse<Person>> {
    const params = this.buildSearchParams(filters);
    return this.http.get<PaginatedResponse<Person>>(
      `${this.apiUrl}/search/page/${page}`,
      { params },
    );
  }

  private buildSearchParams(filters: PersonSearchFilters): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }
}
