import { ContractStatus } from './contract-status.enum';
import { ContractType } from './contract-type.enum';
import { PaymentMethod } from './payment-method.enum';
import { VehicleKind } from './vehicle-kind.enum';

export interface PurchaseSale {
  id?: number;
  clientId: number;
  userId: number;
  vehicleId?: number | null;
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
  vehicleData?: VehicleCreationPayload;
}

export interface VehicleCreationPayload {
  vehicleType: VehicleKind;
  brand: string;
  model: string;
  capacity: number;
  line: string;
  plate: string;
  motorNumber: string;
  serialNumber: string;
  chassisNumber: string;
  color: string;
  cityRegistered: string;
  year: number;
  mileage: number;
  transmission: string;
  purchasePrice?: number | null;
  salePrice?: number | null;
  photoUrl?: string;
  bodyType?: string;
  fuelType?: string;
  numberOfDoors?: number | null;
  motorcycleType?: string;
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
