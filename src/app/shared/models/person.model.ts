import { Address } from './address.model';

export class Person {
  id!: number;
  nationalId!: number;
  firstName!: string;
  lastName!: string;
  address!: Address;
  phoneNumber!: number;
  email!: string;
}
