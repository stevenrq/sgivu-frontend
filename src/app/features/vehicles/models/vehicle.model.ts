import { VehicleStatus } from './vehicle-status.enum';

/**
 * Modelo base de vehículo disponible en el inventario SGIVU.
 * Incluye datos de identificación, estado y métricas comerciales.
 */
export class Vehicle {
  id!: number;
  brand!: string;
  model!: string;
  capacity!: number;
  line!: string;
  plate!: string;
  motorNumber!: string;
  serialNumber!: string;
  chassisNumber!: string;
  color!: string;
  cityRegistered!: string;
  year!: number;
  mileage!: number;
  transmission!: string;
  status!: VehicleStatus;
  purchasePrice!: number;
  salePrice!: number;
  createdAt?: string;
  updatedAt?: string;
}
