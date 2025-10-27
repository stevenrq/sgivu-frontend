import { Address } from '../../../shared/models/address.model';

export class Client {
  id!: number;
  address!: Address;
  phoneNumber!: string;
  email!: string;
  enabled: boolean = true;
}
