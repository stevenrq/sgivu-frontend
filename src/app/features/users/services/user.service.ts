import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { User } from '../../../shared/models/user.model';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { UserCount } from '../../../shared/interfaces/user-count.interface';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/v1/users`;

  private readonly usersState: WritableSignal<User[]> = signal<User[]>([]);

  private readonly usersPagerState: WritableSignal<PaginatedResponse<User>> =
    signal<PaginatedResponse<User>>({} as PaginatedResponse<User>);

  constructor(private readonly http: HttpClient) {}

  public getUsersState(): WritableSignal<User[]> {
    return this.usersState;
  }

  public getUsersPagerState(): WritableSignal<PaginatedResponse<User>> {
    return this.usersPagerState;
  }

  public create(user: User): Observable<User> {
    return this.http
      .post<User>(this.apiUrl, user)
      .pipe(
        tap((newUser) =>
          this.usersState.update((currentUsers) => [...currentUsers, newUser]),
        ),
      );
  }

  public getAll(): Observable<User[]> {
    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(tap((users) => this.usersState.set(users)));
  }

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

  public getUserCount(): Observable<UserCount> {
    return this.http.get<UserCount>(`${this.apiUrl}/count`);
  }

  public getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

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

  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

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

  public searchUsersByName(name: string): Observable<User[]> {
    const params = new HttpParams().set('name', name);
    return this.http.get<User[]>(`${this.apiUrl}/search`, { params });
  }
}
