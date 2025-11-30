import { Vehicle } from './vehicle.model';

/**
 * Metadatos de una imagen asociada a un vehículo en almacenamiento externo.
 */
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
