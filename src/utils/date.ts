import { format, isValid, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * Dynamic timezone based on Application Settings derived from the DB.
 */
export function getTimezone(): string {
  return useSettingsStore?.getState()?.operational_timezone || 'Asia/Jakarta';
}

/**
 * Formats a date string or object into a local timezone-specific format.
 * Uses Intl.DateTimeFormat to ensure the timezone is correctly handled.
 */
export function formatLocal(
  date: Date | string | number | null | undefined,
  formatStr: string = 'dd MMM yyyy, HH:mm'
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(d)) return '-';

  const tz = getTimezone();

  // Use Intl to get the date in the local timezone
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  parts.forEach(p => (map[p.type] = p.value));

  // Construct a new Date object that represents the same wall-clock time locally
  // This is a workaround to use date-fns format while enforcing local time
  const localDate = new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );

  return format(localDate, formatStr, { locale: id });
}

/**
 * Checks if a given date is "today" in local timezone.
 */
export function isLocalToday(date: Date | string | number): boolean {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(d)) return false;

  const { start, end } = getLocalTodayRange();
  const time = d.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * Returns a new Date object representing the current "wall-clock" time locally.
 * WARNING: Use primarily for display and relative calculations (e.g. start of day).
 */
export function getLocalNow(): Date {
  const now = new Date();
  const tz = getTimezone();
  const localStr = now.toLocaleString('en-US', { timeZone: tz });
  return new Date(localStr);
}

/**
 * Returns the current date at the start of the day locally.
 * Useful for Supabase queries and "Today" filters.
 */
export function getLocalTodayRange() {
  const localNow = getLocalNow();
  
  const start = new Date(localNow);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(localNow);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Utility to get start of month locally.
 */
export function getLocalStartOfMonth() {
  const now = getLocalNow();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Calculates the difference in days between two local dates.
 */
export function differenceInDaysLocal(dateLeft: Date | string, dateRight: Date | string): number {
  const left = typeof dateLeft === 'string' ? new Date(dateLeft) : dateLeft;
  const right = typeof dateRight === 'string' ? new Date(dateRight) : dateRight;
  
  const tz = getTimezone();
  
  // Convert to local wall-clock time for accurate local day diff
  const leftLocal = new Date(left.toLocaleString('en-US', { timeZone: tz }));
  const rightLocal = new Date(right.toLocaleString('en-US', { timeZone: tz }));
  
  const diffTime = Math.abs(leftLocal.getTime() - rightLocal.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns a human-friendly string for "Today", "Yesterday", or the date locally.
 */
export function formatRelativeLocal(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  
  if (isLocalToday(d)) {
    return `Hari Ini, ${formatLocal(d, 'HH:mm')}`;
  }
  
  const { start: todayStart } = getLocalTodayRange();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);
  yesterdayEnd.setMilliseconds(-1);
  
  const time = d.getTime();
  if (time >= yesterdayStart.getTime() && time <= yesterdayEnd.getTime()) {
    return `Kemarin, ${formatLocal(d, 'HH:mm')}`;
  }
  
  return formatLocal(d, 'dd MMM yyyy, HH:mm');
}
