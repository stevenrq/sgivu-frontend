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
  clientSummary?: ClientSummary;
  userSummary?: UserSummary;
  vehicleSummary?: VehicleSummary;
}

export interface ClientSummary {
  id: number;
  type: string;
  name: string;
  identifier?: string;
  email?: string;
  phoneNumber?: number;
}

export interface UserSummary {
  id: number;
  fullName: string;
  email?: string;
  username?: string;
}

export interface VehicleSummary {
  id: number;
  type: string;
  brand?: string;
  model?: string;
  plate?: string;
  status?: string;
}
