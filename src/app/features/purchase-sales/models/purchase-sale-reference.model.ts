import { Person } from '../../clients/models/person.model.';
import { Company } from '../../clients/models/company.model';
import { User } from '../../users/models/user.model';
import { Car } from '../../vehicles/models/car.model';
import { Motorcycle } from '../../vehicles/models/motorcycle.model';
import { VehicleStatus } from '../../vehicles/models/vehicle-status.enum';

/**
 * Opción reutilizable para selects de clientes en formularios de contratos.
 */
export interface ClientOption {
  id: number;
  label: string;
  type: 'PERSON' | 'COMPANY';
}

/**
 * Representa a un usuario asesor listado como opción en formularios.
 */
export interface UserOption {
  id: number;
  label: string;
}

/**
 * Opción de vehículo disponible para asociar a un contrato.
 */
export interface VehicleOption {
  id: number;
  label: string;
  status: VehicleStatus;
  type: 'CAR' | 'MOTORCYCLE';
  purchasePrice?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Convierte una lista de personas en opciones legibles para selects.
 *
 * @param persons Personas recuperadas desde el backend.
 */
export function mapPersonsToClients(persons: Person[]): ClientOption[] {
  return persons
    .filter((person) => person.id)
    .map((person) => ({
      id: person.id!,
      label: `${person.firstName} ${person.lastName} (CC ${person.nationalId ?? 'N/A'})`,
      type: 'PERSON' as const,
    }));
}

/**
 * Convierte empresas en opciones de cliente, resaltando su NIT.
 *
 * @param companies Empresas disponibles.
 */
export function mapCompaniesToClients(companies: Company[]): ClientOption[] {
  return companies
    .filter((company) => company.id)
    .map((company) => ({
      id: company.id!,
      label: `${company.companyName} (NIT ${company.taxId ?? 'N/A'})`,
      type: 'COMPANY' as const,
    }));
}

/**
 * Construye opciones de usuario mostrando nombre y alias para diferenciarlos.
 *
 * @param users Usuarios recuperados de la API.
 */
export function mapUsersToOptions(users: User[]): UserOption[] {
  return users
    .filter((user) => !!user.id)
    .map((user) => ({
      id: user.id!,
      label: `${user.firstName} ${user.lastName} (@${user.username})`,
    }));
}

/**
 * Adapta la colección de carros a opciones legibles, incluyendo placas y estado.
 *
 * @param cars Carros disponibles.
 */
export function mapCarsToVehicles(cars: Car[]): VehicleOption[] {
  return cars
    .filter((car) => !!car.id)
    .map((car) => ({
      id: car.id,
      label: `${car.brand} ${car.model} (${car.plate})`,
      status: car.status,
      type: 'CAR' as const,
      purchasePrice: car.purchasePrice,
      createdAt: car.createdAt ?? null,
      updatedAt: car.updatedAt ?? null,
    }));
}

/**
 * Adapta motocicletas a opciones con información mínima para selects.
 *
 * @param motorcycles Motocicletas disponibles.
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
      purchasePrice: motorcycle.purchasePrice,
      createdAt: motorcycle.createdAt ?? null,
      updatedAt: motorcycle.updatedAt ?? null,
    }));
}
