import { Role } from '@prisma/client';

export type Permission =
  | 'tasks:read:any'
  | 'tasks:write:any'
  | 'tasks:read:own'
  | 'tasks:write:own'
  | 'projects:manage'
  | 'users:manage'
  | 'groups:manage'
  | 'analytics:read';

const permissionMatrix: Record<Role, Set<Permission>> = {
  OWNER: new Set([
    'tasks:read:any',
    'tasks:write:any',
    'tasks:read:own',
    'tasks:write:own',
    'projects:manage',
    'users:manage',
    'groups:manage',
    'analytics:read',
  ]),
  ADMIN: new Set([
    'tasks:read:any',
    'tasks:write:any',
    'tasks:read:own',
    'tasks:write:own',
    'projects:manage',
    'users:manage',
    'groups:manage',
    'analytics:read',
  ]),
  MEMBER: new Set([
    'tasks:read:own',
    'tasks:write:own',
  ]),
  VIEWER: new Set([
    'tasks:read:any',
    'tasks:read:own',
  ]),
  GUEST: new Set([
    'tasks:read:own',
  ]),
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  return permissionMatrix[role]?.has(permission) ?? false;
};
