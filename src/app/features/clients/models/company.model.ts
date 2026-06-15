import { Client } from './client.model';

export class Company extends Client {
  taxId!: number;
  companyName!: string;
}
