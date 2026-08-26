import { SetMetadata } from '@nestjs/common';
import { DefaultRole } from '../../roles/app-role.schema';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users whose role name matches one of the given roles.
 * Has no effect if the route is marked with @Public().
 */
export const Roles = (...roles: (DefaultRole | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
