import { Person } from '../../clients/models/person.model.';
import { Company } from '../../clients/models/company.model';
import { User } from '../../users/models/user.model';
import { Car } from '../../vehicles/models/car.model';
import { Motorcycle } from '../../vehicles/models/motorcycle.model';
import { VehicleStatus } from '../../vehicles/models/vehicle-status.enum';

export interface ClientOption {
  id: number;
  label: string;
  type: 'PERSON' | 'COMPANY';
}

export interface UserOption {
  id: number;
  label: string;
}

export interface VehicleOption {
  id: number;
  label: string;
  status: VehicleStatus;
  type: 'CAR' | 'MOTORCYCLE';
  purchasePrice?: number | null;
}

export function mapPersonsToClients(persons: Person[]): ClientOption[] {
  return persons
    .filter((person) => person.id)
    .map((person) => ({
      id: person.id!,
      label: `${person.firstName} ${person.lastName} (CC ${person.nationalId ?? 'N/A'})`,
      type: 'PERSON' as const,
    }));
}

export function mapCompaniesToClients(companies: Company[]): ClientOption[] {
  return companies
    .filter((company) => company.id)
    .map((company) => ({
      id: company.id!,
      label: `${company.companyName} (NIT ${company.taxId ?? 'N/A'})`,
      type: 'COMPANY' as const,
    }));
}

export function mapUsersToOptions(users: User[]): UserOption[] {
  return users
    .filter((user) => !!user.id)
    .map((user) => ({
      id: user.id!,
      label: `${user.firstName} ${user.lastName} (@${user.username})`,
    }));
}

export function mapCarsToVehicles(cars: Car[]): VehicleOption[] {
  return cars
    .filter((car) => !!car.id)
    .map((car) => ({
      id: car.id,
      label: `${car.brand} ${car.model} (${car.plate})`,
      status: car.status,
      type: 'CAR' as const,
      purchasePrice: car.purchasePrice,
    }));
}

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
    }));
}
