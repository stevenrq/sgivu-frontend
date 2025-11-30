import { Vehicle } from './vehicle.model';

/**
 * Vehículo tipo automóvil con atributos específicos (carrocería, puertas, combustible).
 */
export class Car extends Vehicle {
  bodyType!: string;
  fuelType!: string;
  numberOfDoors!: number;
}
