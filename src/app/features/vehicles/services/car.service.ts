import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Car } from '../models/car.model';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { VehicleCount } from '../interfaces/vehicle-count.interface';
import { VehicleStatus } from '../models/vehicle-status.enum';

interface RawCarCountResponse {
  totalCars: number;
  availableCars: number;
  unavailableCars: number;
}

export interface CarSearchFilters {
  plate?: string;
  brand?: string;
  line?: string;
  model?: string;
  fuelType?: string;
  bodyType?: string;
  transmission?: string;
  cityRegistered?: string;
  status?: VehicleStatus | '';
  minYear?: number | null;
  maxYear?: number | null;
  minCapacity?: number | null;
  maxCapacity?: number | null;
  minMileage?: number | null;
  maxMileage?: number | null;
  minSalePrice?: number | null;
  maxSalePrice?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CarService {
  private readonly apiUrl = `${environment.apiUrl}/v1/cars`;

  private readonly carsState: WritableSignal<Car[]> = signal<Car[]>([]);

  private readonly carsPagerState: WritableSignal<PaginatedResponse<Car>> =
    signal<PaginatedResponse<Car>>({} as PaginatedResponse<Car>);

  private readonly jsonHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private readonly http: HttpClient) {}

  getState(): WritableSignal<Car[]> {
    return this.carsState;
  }

  getPagerState(): WritableSignal<PaginatedResponse<Car>> {
    return this.carsPagerState;
  }

  create(payload: Car): Observable<Car> {
    return this.http.post<Car>(this.apiUrl, payload).pipe(
      tap((created) => {
        this.carsState.update((cars) => [...cars, created]);
      }),
    );
  }

  getAll(): Observable<Car[]> {
    return this.http.get<Car[]>(this.apiUrl).pipe(
      tap((cars) => {
        this.carsState.set(cars);
      }),
    );
  }

  getAllPaginated(page: number): Observable<PaginatedResponse<Car>> {
    return this.http
      .get<PaginatedResponse<Car>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((pager) => {
          this.carsPagerState.set(pager);
        }),
      );
  }

  getCounts(): Observable<VehicleCount> {
    return this.http
      .get<RawCarCountResponse>(`${this.apiUrl}/count`)
      .pipe(
        map((response) => ({
          total: response.totalCars,
          available: response.availableCars,
          unavailable: response.unavailableCars,
        })),
      );
  }

  getById(id: number): Observable<Car> {
    return this.http.get<Car>(`${this.apiUrl}/${id}`);
  }

  update(id: number, payload: Car): Observable<Car> {
    return this.http.put<Car>(`${this.apiUrl}/${id}`, payload).pipe(
      tap((updated) => {
        this.carsState.update((cars) =>
          cars.map((car) => (car.id === updated.id ? updated : car)),
        );
      }),
    );
  }

  changeStatus(id: number, status: VehicleStatus): Observable<VehicleStatus> {
    return this.http
      .patch<{ status: string }>(
        `${this.apiUrl}/${id}/status`,
        JSON.stringify(status),
        { headers: this.jsonHeaders },
      )
      .pipe(
        tap((response) => {
          this.carsState.update((cars) =>
            cars.map((car) =>
              car.id === id
                ? { ...car, status: response.status as VehicleStatus }
                : car,
            ),
          );
        }),
        map((response) => response.status as VehicleStatus),
      );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.carsState.update((cars) => cars.filter((car) => car.id !== id));
      }),
    );
  }

  search(filters: Partial<CarSearchFilters>): Observable<Car[]> {
    const params = this.buildSearchParams(filters);
    return this.http.get<Car[]>(`${this.apiUrl}/search`, { params });
  }

  searchPaginated(
    page: number,
    filters: Partial<CarSearchFilters>,
  ): Observable<PaginatedResponse<Car>> {
    const params = this.buildSearchParams(filters);
    return this.http.get<PaginatedResponse<Car>>(
      `${this.apiUrl}/search/page/${page}`,
      { params },
    );
  }

  private buildSearchParams(filters: Partial<CarSearchFilters>): HttpParams {
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
