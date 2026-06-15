import { ContractStatus } from './contract-status.enum';

export interface ContractStatusHistory {
  id?: number;
  purchaseSaleId: number;
  previousStatus: ContractStatus | null;
  newStatus: ContractStatus;
  changedBy: number | null;
  changedAt: string;
  reason: string | null;
}
