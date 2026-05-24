import { Injectable, Signal, signal, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { UserCount } from '../interfaces/user-count.interface';

/** Filtros de búsqueda disponibles para el endpoint de usuarios. */
export interface UserSearchFilters {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  enabled?: boolean | '' | null;
}

/**
 * Servicio de gestión de usuarios.
 * Mantiene el estado de la lista y el paginador como Signals de solo lectura.
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/users`;

  private readonly usersState = signal<User[]>([]);

  private readonly usersPagerState = signal<PaginatedResponse<User>>(
    {} as PaginatedResponse<User>,
  );

  /** Retorna el Signal de solo lectura con la lista de usuarios cargados. */
  public getUsersState(): Signal<User[]> {
    return this.usersState.asReadonly();
  }

  /** Retorna el Signal de solo lectura con la última respuesta paginada. */
  public getUsersPagerState(): Signal<PaginatedResponse<User>> {
    return this.usersPagerState.asReadonly();
  }

  /**
   * Crea un nuevo usuario y lo agrega al estado local.
   *
   * @param user - Datos del usuario a crear.
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
   * Obtiene todos los usuarios y actualiza el estado local.
   *
   * @returns Observable con la lista completa de usuarios.
   */
  public getAll(): Observable<User[]> {
    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(tap((users) => this.usersState.set(users)));
  }

  /**
   * Obtiene una página de usuarios y actualiza el estado y el paginador.
   *
   * @param page - Índice de la página a obtener (base 0).
   * @returns Observable con la respuesta paginada.
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
   * Obtiene los conteos de usuarios activos e inactivos.
   *
   * @returns Observable con los conteos de usuarios.
   */
  public getUserCount(): Observable<UserCount> {
    return this.http.get<UserCount>(`${this.apiUrl}/count`);
  }

  /**
   * Obtiene un usuario por su identificador.
   *
   * @param id - Identificador del usuario.
   * @returns Observable con el usuario encontrado.
   */
  public getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  /**
   * Actualiza un usuario y sincroniza el estado local.
   *
   * @param id - Identificador del usuario a actualizar.
   * @param user - Nuevos datos del usuario.
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
   * Actualiza el estado activo/inactivo de un usuario.
   *
   * @param id - Identificador del usuario.
   * @param status - Nuevo estado (`true` = activo, `false` = inactivo).
   * @returns Observable con el nuevo estado del usuario.
   */
  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

  /**
   * Elimina un usuario y lo remueve del estado local.
   *
   * @param id - Identificador del usuario a eliminar.
   * @returns Observable vacío que completa al eliminar.
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
   * Busca usuarios aplicando los filtros indicados.
   *
   * @param filters - Criterios de búsqueda (nombre, username, email, rol, estado).
   * @returns Observable con la lista de usuarios que coinciden.
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
   * Busca usuarios paginados aplicando los filtros indicados.
   *
   * @param page - Índice de la página (base 0).
   * @param filters - Criterios de búsqueda.
   * @returns Observable con la respuesta paginada filtrada.
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
