import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Car } from '../models/car.model';
import { VehicleCount } from '../interfaces/vehicle-count.interface';
import { VehicleStatus } from '../models/vehicle-status.enum';
import {
  CrudOperations,
  createCrudOperations,
} from '../../../shared/utils/crud-operations.factory';

interface RawCarCountResponse {
  totalCars: number;
  availableCars: number;
  unavailableCars: number;
}

/** Filtros de búsqueda disponibles para el endpoint de automóviles. */
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
 * Servicio de gestión de automóviles del inventario.
 * Delega las operaciones CRUD a `createCrudOperations` y expone
 * el estado como Signals de solo lectura.
 */
@Injectable({
  providedIn: 'root',
})
export class CarService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/cars`;

  private readonly jsonHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  private readonly crud: CrudOperations<Car, CarSearchFilters, VehicleCount> =
    createCrudOperations<
      Car,
      CarSearchFilters,
      RawCarCountResponse,
      VehicleCount
    >({
      http: this.http,
      apiUrl: this.apiUrl,
      mapCounts: (r) => ({
        total: r.totalCars,
        available: r.availableCars,
        unavailable: r.unavailableCars,
      }),
    });

  readonly state = this.crud.state;
  readonly pagerState = this.crud.pagerState;

  getState = () => this.crud._writableState;
  getPagerState = () => this.crud.pagerState;

  create = (payload: Car) => this.crud.create(payload);
  getAll = () => this.crud.getAll();
  getAllPaginated = (page: number) => this.crud.getAllPaginated(page);
  getCounts = () => this.crud.getCounts();
  getById = (id: number) => this.crud.getById(id);
  update = (id: number, payload: Car) => this.crud.update(id, payload);
  delete = (id: number) => this.crud.delete(id);
  search = (filters: Partial<CarSearchFilters>) => this.crud.search(filters);
  searchPaginated = (page: number, filters: Partial<CarSearchFilters>) =>
    this.crud.searchPaginated(page, filters);

  /**
   * Actualiza el estado de un automóvil y sincroniza el estado local.
   * Envía el valor de `VehicleStatus` como JSON string porque el backend espera un string plano.
   *
   * @param id - Identificador del automóvil.
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
          this.crud._writableState.update((cars) =>
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
}
