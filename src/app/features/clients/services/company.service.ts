import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { CompanyCount } from '../interfaces/company-count.interface';
import { Company } from '../models/company.model';

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

  public getCompaniesState(): WritableSignal<Company[]> {
    return this.companiesState;
  }

  public getCompaniesPagerState(): WritableSignal<PaginatedResponse<Company>> {
    return this.companiesPagerState;
  }

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

  public getAll(): Observable<Company[]> {
    return this.http
      .get<Company[]>(this.apiUrl)
      .pipe(tap((companies) => this.companiesState.set(companies)));
  }

  public getAllPaginated(page: number): Observable<PaginatedResponse<Company>> {
    return this.http
      .get<PaginatedResponse<Company>>(`${this.apiUrl}/page/${page}`)
      .pipe(
        tap((paginatedResponse) =>
          this.companiesPagerState.set(paginatedResponse),
        ),
      );
  }

  public getCompanyCount(): Observable<CompanyCount> {
    return this.http.get<CompanyCount>(`${this.apiUrl}/count`);
  }

  public getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/${id}`);
  }

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

  public updateStatus(id: number, status: boolean): Observable<boolean> {
    return this.http.patch<boolean>(`${this.apiUrl}/${id}/status`, status);
  }

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

  public searchCompaniesByName(companyName: string): Observable<Company[]> {
    const params = new HttpParams().set('companyName', companyName);
    return this.http.get<Company[]>(`${this.apiUrl}/search`, { params });
  }
}
