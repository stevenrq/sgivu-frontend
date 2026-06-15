import { Vehicle } from './vehicle.model';

export class VehicleImage {
  id!: number;
  vehicle!: Vehicle;
  bucket!: string;
  key!: string;
  fileName!: string;
  mimeType!: string;
  size!: number;
  primaryImage!: boolean;
  createdAt?: string;
}
