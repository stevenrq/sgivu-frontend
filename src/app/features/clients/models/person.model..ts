import { Client } from './client.model';

export class Person extends Client {
  nationalId!: number;
  firstName!: string;
  lastName!: string;
}
