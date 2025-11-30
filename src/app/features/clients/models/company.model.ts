import { Client } from './client.model';

/**
 * Representa a un cliente corporativo con NIT y razón social.
 */
export class Company extends Client {
  taxId!: number;
  companyName!: string;
}
