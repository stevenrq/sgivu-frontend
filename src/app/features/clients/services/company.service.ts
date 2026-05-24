import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanyCount } from '../interfaces/company-count.interface';
import { Company } from '../models/company.model';
import {
  CrudOperations,
  createCrudOperations,
} from '../../../shared/utils/crud-operations.factory';

/** Filtros de búsqueda disponibles para el endpoint de empresas cliente. */
export interface CompanySearchFilters {
  companyName?: string;
  taxId?: string;
  email?: string;
  phoneNumber?: string;
  enabled?: boolean | '' | 'true' | 'false';
  city?: string;
}

/**
 * Servicio de gestión de clientes empresa.
 * Delega las operaciones CRUD a `createCrudOperations` y expone
 * el estado como Signals de solo lectura.
 */
@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/companies`;

  private readonly crud: CrudOperations<
    Company,
    CompanySearchFilters,
    CompanyCount
  > = createCrudOperations<
    Company,
    CompanySearchFilters,
    CompanyCount,
    CompanyCount
  >({
    http: this.http,
    apiUrl: this.apiUrl,
  });

  readonly state = this.crud.state;
  readonly pagerState = this.crud.pagerState;

  getCompaniesState = () => this.crud._writableState;
  getCompaniesPagerState = () => this.crud.pagerState;

  create = (company: Company) => this.crud.create(company);
  getAll = () => this.crud.getAll();
  getAllPaginated = (page: number) => this.crud.getAllPaginated(page);
  getCompanyCount = () => this.crud.getCounts();
  getById = (id: number) => this.crud.getById(id);
  update = (id: number, company: Company) => this.crud.update(id, company);
  delete = (id: number) => this.crud.delete(id);
  search = (filters: CompanySearchFilters) => this.crud.search(filters);
  searchPaginated = (page: number, filters: CompanySearchFilters) =>
    this.crud.searchPaginated(page, filters);

  /**
   * Actualiza el estado activo/inactivo de una empresa cliente.
   *
   * @param id - Identificador de la empresa.
   * @param status - Nuevo estado (`true` = activo, `false` = inactivo).
   * @returns Observable con el nuevo estado.
   */
  updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }
}
