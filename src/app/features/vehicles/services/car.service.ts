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

/**
 * @description Filtros admitidos para buscar vehículos tipo carro en el inventario SGIVU.
 */
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

/**
 * @description Servicio dedicado a la gestión de carros usados: controla cache local, búsqueda avanzada y cambios de estado en el inventario.
 */
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

  /**
   * @description Exposición de la señal con los carros cargados en memoria.
   * @returns Señal escribible con el inventario actual de carros.
   */
  getState(): WritableSignal<Car[]> {
    return this.carsState;
  }

  /**
   * @description Devuelve el estado paginado de carros para sincronizar componentes de navegación.
   * @returns Señal con el paginador activo.
   */
  getPagerState(): WritableSignal<PaginatedResponse<Car>> {
    return this.carsPagerState;
  }

  /**
   * @description Registra un carro y actualiza inmediatamente el estado local para que listados reflejen el alta.
   * @param payload Carro a crear.
   * @returns Observable con la entidad creada.
   */
  create(payload: Car): Observable<Car> {
    return this.http.post<Car>(this.apiUrl, payload).pipe(
      tap((created) => {
        this.carsState.update((cars) => [...cars, created]);
      }),
    );
  }

  /**
   * @description Recupera todos los carros del inventario y sincroniza la cache en memoria.
   * @returns Observable con la colección completa.
   */
  getAll(): Observable<Car[]> {
    return this.http.get<Car[]>(this.apiUrl).pipe(
      tap((cars) => {
        this.carsState.set(cars);
      }),
    );
  }

  /**
   * @description Trae la página solicitada de carros para listados extensos.
   * @param page Índice de página (cero-based).
   * @returns Observable con la página solicitada.
   */
  getAllPaginated(page: number): Observable<PaginatedResponse<Car>> {
    return this.http
      .get<PaginatedResponse<Car>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((pager) => {
          this.carsPagerState.set(pager);
        }),
      );
  }

  /**
   * @description Obtiene contadores de disponibilidad de carros (totales, disponibles, no disponibles) para KPIs de inventario.
   * @returns Observable con métricas agregadas.
   */
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

  /**
   * @description Recupera un carro por id para edición o detalle.
   * @param id Identificador del carro.
   * @returns Observable con la entidad.
   */
  getById(id: number): Observable<Car> {
    return this.http.get<Car>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Actualiza un carro y sincroniza el estado local para evitar recargas completas de inventario.
   * @param id Identificador del carro.
   * @param payload Datos actualizados.
   * @returns Observable con la entidad modificada.
   */
  update(id: number, payload: Car): Observable<Car> {
    return this.http.put<Car>(`${this.apiUrl}/${id}`, payload).pipe(
      tap((updated) => {
        this.carsState.update((cars) =>
          cars.map((car) => (car.id === updated.id ? updated : car)),
        );
      }),
    );
  }

  /**
   * @description Cambia el estado operativo del carro (disponible/no disponible) y refleja el cambio en la cache.
   * @param id Identificador del carro.
   * @param status Nuevo estado de negocio.
   * @returns Observable con el estado final del vehículo.
   */
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

  /**
   * @description Elimina un carro del inventario y actualiza el estado local.
   * @param id Identificador del carro.
   * @returns Observable vacío cuando la operación finaliza.
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.carsState.update((cars) => cars.filter((car) => car.id !== id));
      }),
    );
  }

  /**
   * @description Ejecuta búsquedas no paginadas usando filtros de placa, modelo, precio, etc. Útil para autocompletados.
   * @param filters Filtros parciales aplicados a la consulta.
   * @returns Observable con resultados filtrados.
   */
  search(filters: Partial<CarSearchFilters>): Observable<Car[]> {
    const params = this.buildSearchParams(filters);
    return this.http.get<Car[]>(`${this.apiUrl}/search`, { params });
  }

  /**
   * @description Variante paginada de búsqueda avanzada sobre carros, usada en listados con filtros persistentes.
   * @param page Página solicitada.
   * @param filters Filtros activos.
   * @returns Observable con la página filtrada.
   */
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
