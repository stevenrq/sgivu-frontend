import { Permission } from './permission.model';

export class Role {
  id!: number;
  name!: string;
  description!: string;
  permissions!: Set<Permission>;
}
