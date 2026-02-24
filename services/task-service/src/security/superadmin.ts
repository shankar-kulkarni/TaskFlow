const parseSuperAdminEmails = (): Set<string> => {
  const raw = String(process.env.SUPER_ADMIN_EMAILS || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const configured = parseSuperAdminEmails();
  if (configured.size === 0) {
    return email.toLowerCase() === 'superadmin@taskflow.local';
  }
  return configured.has(email.toLowerCase());
};

