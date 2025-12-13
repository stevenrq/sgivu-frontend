import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PurchaseSale } from '../models/purchase-sale.model';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { ContractType } from '../models/contract-type.enum';
import { ContractStatus } from '../models/contract-status.enum';
import { PaymentMethod } from '../models/payment-method.enum';

/**
 * @description Filtros admitidos por el backend para localizar contratos de compra/venta con detalle de negocio.
 */
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
 * @description Servicio de orquestación para contratos de compra/venta de vehículos usados. Expone operaciones CRUD, búsqueda y generación de reportes para gestión comercial y de inventario.
 */
@Injectable({
  providedIn: 'root',
})
export class PurchaseSaleService {
  private readonly apiUrl = `${environment.apiUrl}/v1/purchase-sales`;

  constructor(private readonly http: HttpClient) {}

  /**
   * @description Crea un contrato de compra/venta e incluye datos financieros y relaciones con cliente, usuario y vehículo.
   * @param payload Contrato a registrar.
   * @returns Observable con el contrato persistido.
   */
  create(payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http.post<PurchaseSale>(this.apiUrl, payload);
  }

  /**
   * @description Actualiza un contrato existente manteniendo la integridad de los vínculos con cliente y vehículo.
   * @param id Identificador del contrato.
   * @param payload Datos actualizados.
   * @returns Observable con el contrato modificado.
   */
  update(id: number, payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http.put<PurchaseSale>(`${this.apiUrl}/${id}`, payload);
  }

  /**
   * @description Obtiene todos los contratos con información detallada; se usa para KPIs y reportes rápidos.
   * @returns Observable con la colección completa.
   */
  getAll(): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/detailed`);
  }

  /**
   * @description Recupera una página de contratos con detalle expandido para listados largos.
   * @param page Página solicitada (cero-based).
   * @returns Observable con la página de contratos.
   */
  getAllPaginated(page: number): Observable<PaginatedResponse<PurchaseSale>> {
    return this.http.get<PaginatedResponse<PurchaseSale>>(
      `${this.apiUrl}/page/${page}/detailed`,
    );
  }

  /**
   * @description Ejecuta búsqueda paginada combinando filtros de negocio (estado, tipo de contrato, método de pago, rango de fechas/precios).
   * @param filters Filtros activos incluyendo paginación.
   * @returns Observable con la página filtrada.
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
   * @description Recupera todos los contratos asociados a un cliente para trazabilidad de relacionamiento.
   * @param clientId Identificador del cliente.
   * @returns Observable con los contratos del cliente.
   */
  getByClientId(clientId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/client/${clientId}`);
  }

  /**
   * @description Obtiene contratos asociados a un usuario (asesor comercial) para seguimiento de desempeño.
   * @param userId Identificador del usuario.
   * @returns Observable con la lista de contratos.
   */
  getByUserId(userId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/user/${userId}`);
  }

  /**
   * @description Lista contratos vinculados a un vehículo específico, útil para validar historial de operaciones sobre el inventario.
   * @param vehicleId Identificador del vehículo.
   * @returns Observable con contratos del vehículo.
   */
  getByVehicleId(vehicleId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/vehicle/${vehicleId}`);
  }

  /**
   * @description Recupera un contrato detallado por id.
   * @param id Identificador del contrato.
   * @returns Observable con el contrato hallado.
   */
  getById(id: number): Observable<PurchaseSale> {
    // El endpoint principal ya devuelve el detalle enriquecido (cliente/usuario/vehículo)
    return this.http.get<PurchaseSale>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Genera el reporte PDF de operaciones en el rango solicitado.
   * @param startDate Fecha inicial (opcional).
   * @param endDate Fecha final (opcional).
   * @returns Observable con el archivo PDF.
   */
  downloadPdf(startDate?: string | null, endDate?: string | null): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/pdf`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  /**
   * @description Genera el reporte Excel de compras/ventas en el rango indicado.
   * @param startDate Fecha inicial (opcional).
   * @param endDate Fecha final (opcional).
   * @returns Observable con el archivo Excel.
   */
  downloadExcel(startDate?: string | null, endDate?: string | null): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/excel`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  /**
   * @description Genera el reporte CSV para integraciones con BI o conciliaciones externas.
   * @param startDate Fecha inicial (opcional).
   * @param endDate Fecha final (opcional).
   * @returns Observable con el archivo CSV.
   */
  downloadCsv(startDate?: string | null, endDate?: string | null): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/csv`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  /**
   * Construye parámetros opcionales para reportes; solo se envían fechas
   * válidas para no afectar el cache del endpoint.
   */
  private buildReportParams(startDate?: string | null, endDate?: string | null): HttpParams {
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    return params;
  }
}
