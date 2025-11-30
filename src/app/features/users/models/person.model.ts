import { Address } from '../../../shared/models/address.model';

/**
 * Representa a una persona (usuario o cliente) con datos básicos de contacto.
 */
export class Person {
  id!: number;
  nationalId!: number;
  firstName!: string;
  lastName!: string;
  address!: Address;
  phoneNumber!: number;
  email!: string;
}
