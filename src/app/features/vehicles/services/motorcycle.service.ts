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

/**
 * @description Filtros admitidos para buscar motocicletas en el inventario de vehículos usados.
 */
export interface MotorcycleSearchFilters {
  plate?: string;
  brand?: string;
  line?: string;
  model?: string;
  motorcycleType?: string;
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
 * @description Servicio para gestionar motocicletas: cachea resultados, soporta búsqueda avanzada y mantiene KPIs de disponibilidad.
 */
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

  /**
   * @description Devuelve la señal con el inventario de motos cargado en memoria.
   * @returns Señal escribible de motocicletas.
   */
  getState(): WritableSignal<Motorcycle[]> {
    return this.motorcyclesState;
  }

  /**
   * @description Estado paginado de motos para sincronizar la UI.
   * @returns Señal de respuesta paginada.
   */
  getPagerState(): WritableSignal<PaginatedResponse<Motorcycle>> {
    return this.motorcyclesPagerState;
  }

  /**
   * @description Registra una nueva motocicleta y actualiza el estado local para reflejarla en listados.
   * @param payload Datos de la moto.
   * @returns Observable con la moto creada.
   */
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

  /**
   * @description Trae todas las motos y sincroniza la cache en memoria.
   * @returns Observable con la colección completa.
   */
  getAll(): Observable<Motorcycle[]> {
    return this.http.get<Motorcycle[]>(this.apiUrl).pipe(
      tap((motorcycles) => {
        this.motorcyclesState.set(motorcycles);
      }),
    );
  }

  /**
   * @description Obtiene una página de motos para listados extensos.
   * @param page Índice de página (cero-based).
   * @returns Observable con la página solicitada.
   */
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

  /**
   * @description Calcula métricas de disponibilidad de motocicletas para tarjetas de estado.
   * @returns Observable con totales, disponibles e indisponibles.
   */
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

  /**
   * @description Obtiene una motocicleta por id para detalle o edición.
   * @param id Identificador de la moto.
   * @returns Observable con la entidad encontrada.
   */
  getById(id: number): Observable<Motorcycle> {
    return this.http.get<Motorcycle>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Actualiza datos de una moto y refleja el cambio en la lista local.
   * @param id Identificador de la moto.
   * @param payload Datos nuevos.
   * @returns Observable con la entidad modificada.
   */
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

  /**
   * @description Cambia el estado de disponibilidad de la moto (por ejemplo, reserva o retirada de inventario).
   * @param id Identificador de la moto.
   * @param status Estado solicitado.
   * @returns Observable con el estado resultante.
   */
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

  /**
   * @description Elimina una moto del inventario y purga su referencia local.
   * @param id Identificador de la moto.
   * @returns Observable vacío cuando finaliza.
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.motorcyclesState.update((motorcycles) =>
          motorcycles.filter((motorcycle) => motorcycle.id !== id),
        );
      }),
    );
  }

  /**
   * @description Búsqueda no paginada de motos según filtros de negocio (placa, tipo, rango de precio).
   * @param filters Filtros parciales.
   * @returns Observable con resultados filtrados.
   */
  search(filters: Partial<MotorcycleSearchFilters>): Observable<Motorcycle[]> {
    const params = this.buildSearchParams(filters);
    return this.http.get<Motorcycle[]>(`${this.apiUrl}/search`, { params });
  }

  /**
   * @description Variante paginada de la búsqueda de motos, usada en listados con filtros persistentes.
   * @param page Página solicitada.
   * @param filters Filtros activos.
   * @returns Observable con página filtrada.
   */
  searchPaginated(
    page: number,
    filters: Partial<MotorcycleSearchFilters>,
  ): Observable<PaginatedResponse<Motorcycle>> {
    const params = this.buildSearchParams(filters);
    return this.http.get<PaginatedResponse<Motorcycle>>(
      `${this.apiUrl}/search/page/${page}`,
      { params },
    );
  }

  /**
   * Construye parámetros de búsqueda excluyendo filtros vacíos antes de
   * enviarlos al backend.
   *
   * @param filters Filtros opcionales provenientes de la UI.
   */
  private buildSearchParams(
    filters: Partial<MotorcycleSearchFilters>,
  ): HttpParams {
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
