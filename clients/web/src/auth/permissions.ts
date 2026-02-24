export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

const normalizeRole = (role?: string | null): WorkspaceRole | '' =>
  String(role || '').toUpperCase() as WorkspaceRole | '';

export const canCreateProject = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === 'OWNER' || normalized === 'ADMIN';
};

export const canCreateOrEditTasks = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'MEMBER';
};

export const canManageWorkspaceMembers = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === 'OWNER' || normalized === 'ADMIN';
};

export const canCommentOnTasks = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'MEMBER' || normalized === 'GUEST';
};

export const canReadOnly = (role?: string | null): boolean => {
  return normalizeRole(role) === 'VIEWER';
};

