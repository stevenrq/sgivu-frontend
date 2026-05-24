import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PurchaseSale } from '../models/purchase-sale.model';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { ContractType } from '../models/contract-type.enum';
import { ContractStatus } from '../models/contract-status.enum';
import { PaymentMethod } from '../models/payment-method.enum';
import { DashboardSummary } from '../../dashboard/models/dashboard-summary.model';

/** Filtros de búsqueda disponibles para el endpoint de contratos de compra-venta. */
export interface PurchaseSaleSearchFilters {
  page?: number;
  size?: number;
  clientId?: number | null;
  userId?: number | null;
  vehicleId?: number | null;
  contractType?: ContractType | '';
  contractStatus?: ContractStatus | '';
  paymentMethod?: PaymentMethod | '';
  startDate?: string | null;
  endDate?: string | null;
  minPurchasePrice?: number | null;
  maxPurchasePrice?: number | null;
  minSalePrice?: number | null;
  maxSalePrice?: number | null;
  term?: string;
}

/**
 * Servicio de gestión de contratos de compra-venta de vehículos.
 * Expone operaciones CRUD, búsqueda con filtros y generación de reportes en PDF/Excel/CSV.
 */
@Injectable({
  providedIn: 'root',
})
export class PurchaseSaleService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/purchase-sales`;

  // Cache de observables para evitar requests duplicados al navegar entre vistas.
  // `refCount: true` libera el cache cuando no quedan suscriptores, evitando fugas de memoria.
  // Se invalida manualmente en create/update/delete.
  private detailedContracts$?: Observable<PurchaseSale[]>;
  private dashboardSummary$?: Observable<DashboardSummary>;

  /**
   * Crea un nuevo contrato de compra-venta.
   *
   * @param payload - Datos del contrato a crear.
   * @returns Observable con el contrato creado.
   */
  create(payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http
      .post<PurchaseSale>(this.apiUrl, payload)
      .pipe(tap(() => this.invalidateCaches()));
  }

  /**
   * Actualiza un contrato de compra-venta existente.
   *
   * @param id - Identificador del contrato.
   * @param payload - Nuevos datos del contrato.
   * @returns Observable con el contrato actualizado.
   */
  update(id: number, payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http
      .put<PurchaseSale>(`${this.apiUrl}/${id}`, payload)
      .pipe(tap(() => this.invalidateCaches()));
  }

  /**
   * Obtiene todos los contratos con información detallada (cliente, vehículo, usuario).
   * Cacheado con `shareReplay` para evitar requests duplicados en la misma navegación.
   * Invalidar con `invalidateCaches()` tras mutaciones.
   */
  getAll(): Observable<PurchaseSale[]> {
    return (this.detailedContracts$ ??= this.http
      .get<PurchaseSale[]>(`${this.apiUrl}/detailed`)
      .pipe(shareReplay({ bufferSize: 1, refCount: true })));
  }

  /**
   * Snapshot agregado del dashboard. Una sola llamada que sustituye el forkJoin previo
   * (vehicleCounts + contracts). Cacheado en servidor 60s y en cliente con shareReplay.
   */
  getDashboardSummary(): Observable<DashboardSummary> {
    return (this.dashboardSummary$ ??= this.http
      .get<DashboardSummary>(`${this.apiUrl}/dashboard-summary`)
      .pipe(shareReplay({ bufferSize: 1, refCount: true })));
  }

  /**
   * Limpia cachés locales. Usado tras mutaciones para que la siguiente lectura golpee el backend.
   */
  invalidateCaches(): void {
    this.detailedContracts$ = undefined;
    this.dashboardSummary$ = undefined;
  }

  /**
   * Obtiene todos los contratos en formato simple, sin enriquecimiento de entidades remotas.
   * Usar cuando solo se necesitan campos propios del contrato (tipo, estado, IDs, precios).
   *
   * @returns Observable con la lista completa de contratos sin summaries.
   */
  getAllSimple(): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(this.apiUrl);
  }

  /**
   * Obtiene una página de contratos con información detallada.
   *
   * @param page - Índice de la página (base 0).
   * @returns Observable con la respuesta paginada.
   */
  getAllPaginated(page: number): Observable<PaginatedResponse<PurchaseSale>> {
    return this.http.get<PaginatedResponse<PurchaseSale>>(
      `${this.apiUrl}/page/${page}/detailed`,
    );
  }

  /**
   * Busca contratos paginados aplicando los filtros indicados.
   * `page` y `size` se extraen del objeto de filtros; los demás campos se pasan como query params.
   *
   * @param filters - Criterios de búsqueda y paginación.
   * @returns Observable con la respuesta paginada filtrada.
   */
  searchPaginated(
    filters: PurchaseSaleSearchFilters,
  ): Observable<PaginatedResponse<PurchaseSale>> {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 0))
      .set('size', String(filters.size ?? 10));

    const optionalFilters = { ...filters };
    delete optionalFilters.page;
    delete optionalFilters.size;

    Object.entries(optionalFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });

    return this.http.get<PaginatedResponse<PurchaseSale>>(
      `${this.apiUrl}/search`,
      { params },
    );
  }

  /**
   * Obtiene los contratos asociados a un cliente específico.
   *
   * @param clientId - Identificador del cliente.
   * @returns Observable con los contratos del cliente.
   */
  getByClientId(clientId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/client/${clientId}`);
  }

  /**
   * Obtiene los contratos gestionados por un usuario específico.
   *
   * @param userId - Identificador del usuario.
   * @returns Observable con los contratos del usuario.
   */
  getByUserId(userId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/user/${userId}`);
  }

  /**
   * Obtiene los contratos asociados a un vehículo específico.
   *
   * @param vehicleId - Identificador del vehículo.
   * @returns Observable con los contratos del vehículo.
   */
  getByVehicleId(vehicleId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/vehicle/${vehicleId}`);
  }

  /**
   * Obtiene un contrato por su identificador.
   *
   * @param id - Identificador del contrato.
   * @returns Observable con el contrato encontrado.
   */
  getById(id: number): Observable<PurchaseSale> {
    return this.http.get<PurchaseSale>(`${this.apiUrl}/${id}`);
  }

  /**
   * Descarga el reporte de contratos en formato PDF.
   *
   * @param startDate - Fecha de inicio del rango (ISO 8601, opcional).
   * @param endDate - Fecha de fin del rango (ISO 8601, opcional).
   * @returns Observable con el `Blob` del archivo PDF.
   */
  downloadPdf(
    startDate?: string | null,
    endDate?: string | null,
  ): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/pdf`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  /**
   * Descarga el reporte de contratos en formato Excel.
   *
   * @param startDate - Fecha de inicio del rango (ISO 8601, opcional).
   * @param endDate - Fecha de fin del rango (ISO 8601, opcional).
   * @returns Observable con el `Blob` del archivo Excel.
   */
  downloadExcel(
    startDate?: string | null,
    endDate?: string | null,
  ): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/excel`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  /**
   * Descarga el reporte de contratos en formato CSV.
   *
   * @param startDate - Fecha de inicio del rango (ISO 8601, opcional).
   * @param endDate - Fecha de fin del rango (ISO 8601, opcional).
   * @returns Observable con el `Blob` del archivo CSV.
   */
  downloadCsv(
    startDate?: string | null,
    endDate?: string | null,
  ): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/csv`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  private buildReportParams(
    startDate?: string | null,
    endDate?: string | null,
  ): HttpParams {
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    return params;
  }

  /**
   * Elimina un contrato de compra-venta.
   *
   * @param id - Identificador del contrato a eliminar.
   * @returns Observable vacío que completa al eliminar.
   */
  deleteById(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(tap(() => this.invalidateCaches()));
  }

  /**
   * Obtiene los IDs de los vehículos que actualmente están disponibles para nuevos contratos de venta..
   *
   * @returns Un Observable que emite un array de números, representando los IDs de los vehículos disponibles para nuevos contratos de venta.
   */
  getAvailableVehicleIds(): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/available-vehicles`);
  }
}
