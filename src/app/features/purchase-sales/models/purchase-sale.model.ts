import { ContractStatus } from './contract-status.enum';
import { ContractType } from './contract-type.enum';
import { PaymentMethod } from './payment-method.enum';
import { VehicleKind } from './vehicle-kind.enum';

/**
 * Contrato principal de una transacción de compra/venta con el backend.
 * Los campos `*Summary` son datos desnormalizados que el backend embebe
 * para evitar N+1 en listados; `vehicleData` solo se envía al crear un
 * contrato que incluye un vehículo nuevo.
 */
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

/**
 * Payload para crear un vehículo inline dentro de un contrato de compra.
 * Existe separado de `Vehicle` porque el flujo de compra permite registrar
 * vehículos que aún no están en el inventario sin pasar por el CRUD de vehículos.
 */
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

/** Resumen de cliente embebido por el backend para evitar joins adicionales en listados. */
export interface ClientSummary {
  id: number;
  /** `PERSON` o `COMPANY` - determina cómo se construyó `name`. */
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
