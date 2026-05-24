import { Person } from './person.model';
import { Role } from '../../../shared/models/role.model';

export class User extends Person {
  username!: string;
  password?: string;
  enabled = true;
  accountNonExpired = true;
  accountNonLocked = true;
  credentialsNonExpired = true;
  admin!: boolean;
  roles!: Set<Role>;
}
