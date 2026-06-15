import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ContractStatusHistory } from '../models/contract-status-history.model';

@Injectable({
  providedIn: 'root',
})
export class ContractStatusHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/v1/contract-status-history`;

  getByContractId(purchaseSaleId: number): Observable<ContractStatusHistory[]> {
    return this.http.get<ContractStatusHistory[]>(
      `${this.apiUrl}/contract/${purchaseSaleId}`,
    );
  }
}
