import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { CompanyCount } from '../interfaces/company-count.interface';
import { Company } from '../models/company.model';

/**
 * @description Filtros soportados para localizar empresas clientes en SGIVU.
 */
export interface CompanySearchFilters {
  companyName?: string;
  taxId?: string;
  email?: string;
  phoneNumber?: string;
  enabled?: boolean | '' | 'true' | 'false';
  city?: string;
}

/**
 * @description Servicio orientado a empresas clientes. Mantiene un cache reactivo para listados y KPI de inventario de clientes corporativos.
 */
@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly apiUrl = `${environment.apiUrl}/v1/companies`;

  private readonly companiesState: WritableSignal<Company[]> = signal<
    Company[]
  >([]);

  private readonly companiesPagerState: WritableSignal<
    PaginatedResponse<Company>
  > = signal<PaginatedResponse<Company>>({} as PaginatedResponse<Company>);

  constructor(readonly http: HttpClient) {}

  /**
   * @description Exposición del estado de empresas cargadas en memoria.
   * @returns Señal escribible con la lista actual.
   */
  public getCompaniesState(): WritableSignal<Company[]> {
    return this.companiesState;
  }

  /**
   * @description Devuelve la señal con la última página consultada para sincronizar paginadores.
   * @returns Señal de respuesta paginada.
   */
  public getCompaniesPagerState(): WritableSignal<PaginatedResponse<Company>> {
    return this.companiesPagerState;
  }

  /**
   * @description Registra una empresa y actualiza el estado local para reflejarla en listados sin nueva consulta.
   * @param company Datos de la empresa a crear.
   * @returns Observable con la entidad creada.
   */
  public create(company: Company): Observable<Company> {
    return this.http
      .post<Company>(this.apiUrl, company)
      .pipe(
        tap((newCompany) =>
          this.companiesState.update((currentCompanies) => [
            ...currentCompanies,
            newCompany,
          ]),
        ),
      );
  }

  /**
   * @description Obtiene todas las empresas (sin paginar) y sincroniza el store interno para catálogos o selects.
   * @returns Observable con la colección completa.
   */
  public getAll(): Observable<Company[]> {
    return this.http
      .get<Company[]>(this.apiUrl)
      .pipe(tap((companies) => this.companiesState.set(companies)));
  }

  /**
   * @description Recupera una página de empresas y actualiza la metadata del paginador.
   * @param page Página solicitada (cero-based).
   * @returns Observable con la página solicitada.
   */
  public getAllPaginated(page: number): Observable<PaginatedResponse<Company>> {
    return this.http
      .get<PaginatedResponse<Company>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((paginatedResponse) =>
          this.companiesPagerState.set(paginatedResponse),
        ),
      );
  }

  /**
   * @description Obtiene KPIs de empresas activas/inactivas para paneles y tarjetas resumen.
   * @returns Observable con métricas agregadas.
   */
  public getCompanyCount(): Observable<CompanyCount> {
    return this.http.get<CompanyCount>(`${this.apiUrl}/count`);
  }

  /**
   * @description Consulta detalles de una empresa específica.
   * @param id Identificador de empresa.
   * @returns Observable con la entidad.
   */
  public getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/${id}`);
  }

  /**
   * @description Actualiza datos de una empresa y sincroniza la lista en memoria.
   * @param id Identificador de la empresa.
   * @param company Datos a persistir.
   * @returns Observable con la entidad actualizada.
   */
  public update(id: number, company: Company): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}`, company).pipe(
      tap((updatedCompany) => {
        this.companiesState.update((companies) =>
          companies.map((company) =>
            company.id === updatedCompany.id ? updatedCompany : company,
          ),
        );
      }),
    );
  }

  /**
   * @description Cambia el estado activo de una empresa (habilitar/deshabilitar).
   * @param id Identificador de la empresa.
   * @param status Estado solicitado.
   * @returns Observable con el estado final.
   */
  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

  /**
   * @description Elimina una empresa y limpia el estado local para que listados reflejen el cambio.
   * @param id Identificador de la empresa.
   * @returns Observable vacío al completar.
   */
  public delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() =>
          this.companiesState.update((companies) =>
            companies.filter((company) => company.id != id),
          ),
        ),
      );
  }

  /**
   * @description Ejecuta búsqueda no paginada de empresas usando filtros combinados (NIT, ciudad, estado, etc.).
   * @param filters Filtros a aplicar.
   * @returns Observable con resultados filtrados.
   */
  public search(filters: CompanySearchFilters): Observable<Company[]> {
    const params = this.buildSearchParams(filters);
    return this.http.get<Company[]>(`${this.apiUrl}/search`, { params });
  }

  /**
   * @description Variante paginada de la búsqueda de empresas; usada en listas con filtros compartidos.
   * @param page Página solicitada.
   * @param filters Filtros activos.
   * @returns Observable con página filtrada.
   */
  public searchPaginated(
    page: number,
    filters: CompanySearchFilters,
  ): Observable<PaginatedResponse<Company>> {
    const params = this.buildSearchParams(filters);
    return this.http.get<PaginatedResponse<Company>>(
      `${this.apiUrl}/search/page/${page}`,
      { params },
    );
  }

  private buildSearchParams(filters: CompanySearchFilters): HttpParams {
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
