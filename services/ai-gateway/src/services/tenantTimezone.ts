import { db } from './db.js';

export const getTenantTimezone = async (tenantId: string): Promise<string> => {
  try {
    const result = await db.query<{ timezone: string | null }>(
      `SELECT COALESCE(timezone, 'UTC') AS timezone FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.timezone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const toParts = (timeZone: string, date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return { year, month, day };
};

export const getTodayISOInTimeZone = (timeZone: string, date = new Date()): string => {
  const { year, month, day } = toParts(timeZone, date);
  return `${year}-${month}-${day}`;
};

export const shiftISODate = (isoDate: string, deltaDays: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
};

export const isDateOverdueInTimeZone = (dueDate: string | Date | null, timeZone: string): boolean => {
  if (!dueDate) return false;
  const dueIso =
    dueDate instanceof Date
      ? dueDate.toISOString().slice(0, 10)
      : String(dueDate).slice(0, 10);
  const todayIso = getTodayISOInTimeZone(timeZone);
  return dueIso < todayIso;
};
