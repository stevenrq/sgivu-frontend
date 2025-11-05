import { ContractStatus } from './contract-status.enum';
import { ContractType } from './contract-type.enum';
import { PaymentMethod } from './payment-method.enum';

export interface PurchaseSale {
  id?: number;
  clientId: number;
  userId: number;
  vehicleId: number;
  purchasePrice: number;
  salePrice: number;
  contractType: ContractType;
  contractStatus: ContractStatus;
  paymentLimitations: string;
  paymentTerms: string;
  paymentMethod: PaymentMethod;
  observations?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
