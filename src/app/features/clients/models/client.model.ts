import { Address } from '../../../shared/models/address.model';

/**
 * Modelo base para clientes (personas o empresas) con datos de contacto comunes.
 */
export class Client {
  id!: number;
  address!: Address;
  phoneNumber!: string;
  email!: string;
  enabled: boolean = true;
}
