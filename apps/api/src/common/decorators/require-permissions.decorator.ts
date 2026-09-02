import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../rbac/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Exige une ou plusieurs permissions atomiques sur la route.
 * Aucun nom de rôle n'apparaît jamais dans le code métier.
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
