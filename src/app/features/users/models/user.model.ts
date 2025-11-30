import { Person } from './person.model';
import { Role } from '../../../shared/models/role.model';

/**
 * Usuario del sistema con credenciales y banderas de estado de cuenta.
 */
export class User extends Person {
  username!: string;
  password?: string;

  enabled: boolean = true;

  accountNonExpired: boolean = true;

  accountNonLocked: boolean = true;

  credentialsNonExpired: boolean = true;
  admin!: boolean;
  roles!: Set<Role>;
}
