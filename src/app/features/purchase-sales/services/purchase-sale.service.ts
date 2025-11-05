import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PurchaseSale } from '../models/purchase-sale.model';
import { PaginatedResponse } from '../../../shared/models/paginated-response';

@Injectable({
  providedIn: 'root',
})
export class PurchaseSaleService {
  private readonly apiUrl = `${environment.apiUrl}/v1/purchase-sales`;

  constructor(private readonly http: HttpClient) {}

  create(payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http.post<PurchaseSale>(this.apiUrl, payload);
  }

  update(id: number, payload: PurchaseSale): Observable<PurchaseSale> {
    return this.http.put<PurchaseSale>(`${this.apiUrl}/${id}`, payload);
  }

  getAll(): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(this.apiUrl);
  }

  getAllPaginated(page: number): Observable<PaginatedResponse<PurchaseSale>> {
    return this.http.get<PaginatedResponse<PurchaseSale>>(
      `${this.apiUrl}/page/${page}`,
    );
  }

  getByClientId(clientId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/client/${clientId}`);
  }

  getByUserId(userId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/user/${userId}`);
  }

  getByVehicleId(vehicleId: number): Observable<PurchaseSale[]> {
    return this.http.get<PurchaseSale[]>(`${this.apiUrl}/vehicle/${vehicleId}`);
  }

  downloadPdf(startDate?: string | null, endDate?: string | null): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/pdf`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

  downloadExcel(startDate?: string | null, endDate?: string | null): Observable<Blob> {
    const params = this.buildReportParams(startDate, endDate);
    return this.http.get<Blob>(`${this.apiUrl}/report/excel`, {
      params,
      responseType: 'blob' as 'json',
    });
  }

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
