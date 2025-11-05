import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { VehicleCount } from '../interfaces/vehicle-count.interface';
import { Motorcycle } from '../models/motorcycle.model';
import { VehicleStatus } from '../models/vehicle-status.enum';

interface RawMotorcycleCountResponse {
  totalMotorcycles: number;
  availableMotorcycles: number;
  unavailableMotorcycles: number;
}

export interface MotorcycleSearchFilters {
  plate?: string;
  brand?: string;
  line?: string;
  model?: string;
  motorcycleType?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MotorcycleService {
  private readonly apiUrl = `${environment.apiUrl}/v1/motorcycles`;

  private readonly motorcyclesState: WritableSignal<Motorcycle[]> =
    signal<Motorcycle[]>([]);

  private readonly motorcyclesPagerState: WritableSignal<
    PaginatedResponse<Motorcycle>
  > = signal<PaginatedResponse<Motorcycle>>({} as PaginatedResponse<Motorcycle>);

  private readonly jsonHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private readonly http: HttpClient) {}

  getState(): WritableSignal<Motorcycle[]> {
    return this.motorcyclesState;
  }

  getPagerState(): WritableSignal<PaginatedResponse<Motorcycle>> {
    return this.motorcyclesPagerState;
  }

  create(payload: Motorcycle): Observable<Motorcycle> {
    return this.http.post<Motorcycle>(this.apiUrl, payload).pipe(
      tap((created) => {
        this.motorcyclesState.update((motorcycles) => [
          ...motorcycles,
          created,
        ]);
      }),
    );
  }

  getAll(): Observable<Motorcycle[]> {
    return this.http.get<Motorcycle[]>(this.apiUrl).pipe(
      tap((motorcycles) => {
        this.motorcyclesState.set(motorcycles);
      }),
    );
  }

  getAllPaginated(
    page: number,
  ): Observable<PaginatedResponse<Motorcycle>> {
    return this.http
      .get<PaginatedResponse<Motorcycle>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((pager) => {
          this.motorcyclesPagerState.set(pager);
        }),
      );
  }

  getCounts(): Observable<VehicleCount> {
    return this.http
      .get<RawMotorcycleCountResponse>(`${this.apiUrl}/count`)
      .pipe(
        map((response) => ({
          total: response.totalMotorcycles,
          available: response.availableMotorcycles,
          unavailable: response.unavailableMotorcycles,
        })),
      );
  }

  getById(id: number): Observable<Motorcycle> {
    return this.http.get<Motorcycle>(`${this.apiUrl}/${id}`);
  }

  update(id: number, payload: Motorcycle): Observable<Motorcycle> {
    return this.http.put<Motorcycle>(`${this.apiUrl}/${id}`, payload).pipe(
      tap((updated) => {
        this.motorcyclesState.update((motorcycles) =>
          motorcycles.map((motorcycle) =>
            motorcycle.id === updated.id ? updated : motorcycle,
          ),
        );
      }),
    );
  }

  changeStatus(
    id: number,
    status: VehicleStatus,
  ): Observable<VehicleStatus> {
    return this.http
      .patch<{ status: string }>(
        `${this.apiUrl}/${id}/status`,
        JSON.stringify(status),
        { headers: this.jsonHeaders },
      )
      .pipe(
        tap((response) => {
          this.motorcyclesState.update((motorcycles) =>
            motorcycles.map((motorcycle) =>
              motorcycle.id === id
                ? { ...motorcycle, status: response.status as VehicleStatus }
                : motorcycle,
            ),
          );
        }),
        map((response) => response.status as VehicleStatus),
      );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.motorcyclesState.update((motorcycles) =>
          motorcycles.filter((motorcycle) => motorcycle.id !== id),
        );
      }),
    );
  }

  search(
    filters: Partial<MotorcycleSearchFilters>,
  ): Observable<Motorcycle[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value as string);
      }
    });

    return this.http.get<Motorcycle[]>(`${this.apiUrl}/search`, { params });
  }
}
