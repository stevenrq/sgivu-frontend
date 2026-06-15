import { Person } from '../../clients/models/person.model';
import { Company } from '../../clients/models/company.model';
import { User } from '../../users/models/user.model';
import { Car } from '../../vehicles/models/car.model';
import { Motorcycle } from '../../vehicles/models/motorcycle.model';
import { VehicleStatus } from '../../vehicles/models/vehicle-status.enum';

/**
 * DTOs aplanados para poblar selects/dropdowns en formularios de compra/venta.
 * Desacoplados de las entidades de dominio completas para que los componentes
 * no dependan de la estructura interna de `Person`, `Company`, `User` o `Vehicle`.
 */
export interface ClientOption {
  id: number;
  label: string;
  type: 'PERSON' | 'COMPANY';
}

export interface UserOption {
  id: number;
  label: string;
}

/** Opción de vehículo para select. Incluye `status` para filtrar vehículos no disponibles en el UI. */
export interface VehicleOption {
  id: number;
  label: string;
  status: VehicleStatus;
  type: 'CAR' | 'MOTORCYCLE';
  line?: string | null;
  plate?: string | null;
  purchasePrice?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Transforma personas de dominio a opciones de cliente. Filtra entidades sin `id` para evitar opciones inválidas.
 *
 * @param persons Lista de personas del dominio.
 * @returns Lista de opciones de cliente con label `NombreApellido (CC xxx)`.
 */
export function mapPersonsToClients(persons: Person[]): ClientOption[] {
  return persons
    .filter((person) => person.id)
    .map((person) => ({
      id: person.id,
      label: `${person.firstName} ${person.lastName} (CC ${person.nationalId ?? 'N/A'})`,
      type: 'PERSON' as const,
    }));
}

/** Transforma empresas de dominio a opciones de cliente con label `NombreEmpresa (NIT xxx)`.
 *
 * @param companies Lista de empresas del dominio.
 * @returns Lista de opciones de cliente con label `NombreEmpresa (NIT xxx)`.
 */
export function mapCompaniesToClients(companies: Company[]): ClientOption[] {
  return companies
    .filter((company) => company.id)
    .map((company) => ({
      id: company.id,
      label: `${company.companyName} (NIT ${company.taxId ?? 'N/A'})`,
      type: 'COMPANY' as const,
    }));
}

/** Transforma usuarios de dominio a opciones de select con label `NombreApellido (@username)`.
 *
 * @param users Lista de usuarios del dominio.
 * @returns Lista de opciones de usuario con label `NombreApellido (@username)`.
 */
export function mapUsersToOptions(users: User[]): UserOption[] {
  return users
    .filter((user) => !!user.id)
    .map((user) => ({
      id: user.id,
      label: `${user.firstName} ${user.lastName} (@${user.username})`,
    }));
}

/** Transforma carros de dominio a opciones de vehículo con metadatos de precio y fechas para el UI.
 *
 * @param cars Lista de carros del dominio.
 * @returns Lista de opciones de vehículo con label `Marca Modelo (Placa)`.
 */
export function mapCarsToVehicles(cars: Car[]): VehicleOption[] {
  return cars
    .filter((car) => !!car.id)
    .map((car) => ({
      id: car.id,
      label: `${car.brand} ${car.model} (${car.plate})`,
      status: car.status,
      type: 'CAR' as const,
      line: car.line ?? null,
      plate: car.plate ?? null,
      purchasePrice: car.purchasePrice,
      createdAt: car.createdAt ?? null,
      updatedAt: car.updatedAt ?? null,
    }));
}

/** Transforma motos de dominio a opciones de vehículo con el mismo formato que `mapCarsToVehicles`.
 *
 * @param motorcycles Lista de motos del dominio.
 * @returns Lista de opciones de vehículo con label `Marca Modelo (Placa)`.
 */
export function mapMotorcyclesToVehicles(
  motorcycles: Motorcycle[],
): VehicleOption[] {
  return motorcycles
    .filter((motorcycle) => !!motorcycle.id)
    .map((motorcycle) => ({
      id: motorcycle.id,
      label: `${motorcycle.brand} ${motorcycle.model} (${motorcycle.plate})`,
      status: motorcycle.status,
      type: 'MOTORCYCLE' as const,
      line: motorcycle.line ?? null,
      plate: motorcycle.plate ?? null,
      purchasePrice: motorcycle.purchasePrice,
      createdAt: motorcycle.createdAt ?? null,
      updatedAt: motorcycle.updatedAt ?? null,
    }));
}
