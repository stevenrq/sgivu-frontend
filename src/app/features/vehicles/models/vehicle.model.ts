import { VehicleStatus } from './vehicle-status.enum';

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
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}
