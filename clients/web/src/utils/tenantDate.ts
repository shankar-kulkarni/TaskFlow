const TENANT_TIMEZONE_KEY = 'taskflow.tenantTimezone';

export const getTenantTimezone = (): string =>
  localStorage.getItem(TENANT_TIMEZONE_KEY) || 'UTC';

export const setTenantTimezone = (timezone?: string | null): void => {
  const value = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
  localStorage.setItem(TENANT_TIMEZONE_KEY, value);
};

export const clearTenantTimezone = (): void => {
  localStorage.removeItem(TENANT_TIMEZONE_KEY);
};

export const getTodayIsoInTenantTimezone = (): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getTenantTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
};

export const toIsoDate = (value?: string | null): string | null => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso) return iso[1];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export const isOverdueForTenant = (dueDate?: string | null): boolean => {
  const dueIso = toIsoDate(dueDate);
  if (!dueIso) return false;
  return dueIso < getTodayIsoInTenantTimezone();
};

export const dayDeltaForTenant = (targetDate?: string | null): number | null => {
  const targetIso = toIsoDate(targetDate);
  if (!targetIso) return null;
  const currentIso = getTodayIsoInTenantTimezone();
  const current = new Date(`${currentIso}T00:00:00.000Z`);
  const target = new Date(`${targetIso}T00:00:00.000Z`);
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
};

