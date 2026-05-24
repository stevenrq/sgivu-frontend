import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VehicleCount } from '../interfaces/vehicle-count.interface';
import { Motorcycle } from '../models/motorcycle.model';
import { VehicleStatus } from '../models/vehicle-status.enum';
import {
  CrudOperations,
  createCrudOperations,
} from '../../../shared/utils/crud-operations.factory';

interface RawMotorcycleCountResponse {
  totalMotorcycles: number;
  availableMotorcycles: number;
  unavailableMotorcycles: number;
}

/** Filtros de búsqueda disponibles para el endpoint de motocicletas. */
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
 * Servicio de gestión de motocicletas del inventario.
 * Delega las operaciones CRUD a `createCrudOperations` y expone
 * el estado como Signals de solo lectura.
 */
@Injectable({
  providedIn: 'root',
})
export class MotorcycleService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/motorcycles`;

  private readonly jsonHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  private readonly crud: CrudOperations<
    Motorcycle,
    MotorcycleSearchFilters,
    VehicleCount
  > = createCrudOperations<
    Motorcycle,
    MotorcycleSearchFilters,
    RawMotorcycleCountResponse,
    VehicleCount
  >({
    http: this.http,
    apiUrl: this.apiUrl,
    mapCounts: (r) => ({
      total: r.totalMotorcycles,
      available: r.availableMotorcycles,
      unavailable: r.unavailableMotorcycles,
    }),
  });

  readonly state = this.crud.state;
  readonly pagerState = this.crud.pagerState;

  getState = () => this.crud._writableState;
  getPagerState = () => this.crud.pagerState;

  create = (payload: Motorcycle) => this.crud.create(payload);
  getAll = () => this.crud.getAll();
  getAllPaginated = (page: number) => this.crud.getAllPaginated(page);
  getCounts = () => this.crud.getCounts();
  getById = (id: number) => this.crud.getById(id);
  update = (id: number, payload: Motorcycle) => this.crud.update(id, payload);
  delete = (id: number) => this.crud.delete(id);
  search = (filters: Partial<MotorcycleSearchFilters>) =>
    this.crud.search(filters);
  searchPaginated = (page: number, filters: Partial<MotorcycleSearchFilters>) =>
    this.crud.searchPaginated(page, filters);

  /**
   * Actualiza el estado de una motocicleta y sincroniza el estado local.
   * Envía el valor de `VehicleStatus` como JSON string porque el backend espera un string plano.
   *
   * @param id - Identificador de la motocicleta.
   * @param status - Nuevo estado del vehículo.
   * @returns Observable con el nuevo estado aplicado.
   */
  changeStatus(id: number, status: VehicleStatus): Observable<VehicleStatus> {
    return this.http
      .patch<{
        status: string;
      }>(`${this.apiUrl}/${id}/status`, JSON.stringify(status), {
        headers: this.jsonHeaders,
      })
      .pipe(
        tap((response) => {
          this.crud._writableState.update((motorcycles) =>
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
}
