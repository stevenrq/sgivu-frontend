import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { UserCount } from '../interfaces/user-count.interface';

/**
 * @description Filtros admitidos por el backend para localizar usuarios según atributos de seguridad y contacto.
 */
export interface UserSearchFilters {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  enabled?: boolean | '' | null;
}

/**
 * @description Servicio centralizado para operar sobre usuarios de SGIVU. Mantiene un estado local sincronizado con el backend para acelerar listados y KPIs.
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/v1/users`;

  private readonly usersState: WritableSignal<User[]> = signal<User[]>([]);

  private readonly usersPagerState: WritableSignal<PaginatedResponse<User>> =
    signal<PaginatedResponse<User>>({} as PaginatedResponse<User>);

  constructor(private readonly http: HttpClient) {}

  /**
   * @description Devuelve la señal reactiva que representa la lista en memoria de usuarios cargados. Permite a la UI reaccionar sin pedir nuevamente al backend.
   * @returns Estado interno de usuarios gestionado con `signal`.
   */
  public getUsersState(): WritableSignal<User[]> {
    return this.usersState;
  }

  /**
   * @description Exposición del paginador en memoria para sincronizar vistas con el resultado más reciente de la API.
   * @returns Señal escribible con la última respuesta paginada.
   */
  public getUsersPagerState(): WritableSignal<PaginatedResponse<User>> {
    return this.usersPagerState;
  }

  /**
   * @description Registra un usuario en SGIVU y actualiza el estado local para que las listas reaccionen inmediatamente.
   * @param user Datos completos del usuario a crear.
   * @returns Observable con el usuario creado.
   */
  public create(user: User): Observable<User> {
    return this.http
      .post<User>(this.apiUrl, user)
      .pipe(
        tap((newUser) =>
          this.usersState.update((currentUsers) => [...currentUsers, newUser]),
        ),
      );
  }

  /**
   * @description Obtiene todos los usuarios sin paginar y sincroniza el estado compartido.
   * @returns Observable con la colección completa de usuarios.
   */
  public getAll(): Observable<User[]> {
    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(tap((users) => this.usersState.set(users)));
  }

  /**
   * @description Solicita la página indicada de usuarios para listados extensos. Sincroniza tanto la lista visible como la metadata del paginador.
   * @param page Número de página solicitado (cero-based).
   * @returns Observable con respuesta paginada.
   */
  public getAllPaginated(page: number): Observable<PaginatedResponse<User>> {
    return this.http
      .get<PaginatedResponse<User>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((paginatedResponse) => {
          this.usersState.set(paginatedResponse.content);
          this.usersPagerState.set(paginatedResponse);
        }),
      );
  }

  /**
   * @description Consulta contadores de usuarios activos/inactivos para KPIs del módulo de seguridad.
   * @returns Observable con métricas de usuarios.
   */
  public getUserCount(): Observable<UserCount> {
    return this.http.get<UserCount>(`${this.apiUrl}/count`);
  }

  /**
   * @description Recupera un usuario puntual para mostrar o editar su perfil.
   * @param id Identificador del usuario.
   * @returns Observable con el usuario encontrado.
   */
  public getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Actualiza los datos de un usuario y refleja el cambio en la cache local para evitar un refetch.
   * @param id Identificador del usuario a actualizar.
   * @param user Datos editados a persistir.
   * @returns Observable con el usuario actualizado.
   */
  public update(id: number, user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user).pipe(
      tap((updatedUser) => {
        this.usersState.update((users) =>
          users.map((user) =>
            user.id === updatedUser.id ? updatedUser : user,
          ),
        );
      }),
    );
  }

  /**
   * @description Alterna el estado activo/inactivo de un usuario. El backend aplica reglas de negocio (por ejemplo, evitar bloquear al último admin).
   * @param id Identificador del usuario.
   * @param status Estado solicitado.
   * @returns Observable con el estado final.
   */
  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

  /**
   * @description Elimina un usuario y purga su referencia del estado local para que la UI refleje la operación.
   * @param id Identificador del usuario a eliminar.
   * @returns Observable vacío cuando la operación finaliza.
   */
  public delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() =>
          this.usersState.update((users) =>
            users.filter((user) => user.id != id),
          ),
        ),
      );
  }

  /**
   * @description Busca usuarios aplicando filtros combinados (nombre, rol, estado, etc.) sin paginar. Útil para selectores o autocompletados.
   * @param filters Filtros de búsqueda; los valores vacíos no se envían.
   * @returns Observable con la colección filtrada.
   */
  public searchUsers(filters: UserSearchFilters): Observable<User[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });

    return this.http.get<User[]>(`${this.apiUrl}/search`, { params });
  }

  /**
   * @description Variante paginada para búsquedas avanzadas. Permite combinar filtros y mantener paginación server-side.
   * @param page Número de página solicitada.
   * @param filters Filtros activos.
   * @returns Observable con la página solicitada.
   */
  public searchUsersPaginated(
    page: number,
    filters: UserSearchFilters,
  ): Observable<PaginatedResponse<User>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });

    return this.http.get<PaginatedResponse<User>>(
      `${this.apiUrl}/search/page/${page}`,
      { params },
    );
  }
}
