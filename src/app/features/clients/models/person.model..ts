import { Client } from './client.model';

/**
 * Cliente tipo persona natural con datos de identificación básicos.
 */
export class Person extends Client {
  nationalId!: number;
  firstName!: string;
  lastName!: string;
}
