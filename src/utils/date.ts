import { format, isValid, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Enforces Asia/Jakarta (WIB, UTC+7) for all date displays.
 */
export const ASIA_JAKARTA = 'Asia/Jakarta';

/**
 * Formats a date string or object into a WIB-specific format.
 * Uses Intl.DateTimeFormat to ensure the timezone is correctly handled.
 */
export function formatWIB(
  date: Date | string | number | null | undefined,
  formatStr: string = 'dd MMM yyyy, HH:mm'
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(d)) return '-';

  // Use Intl to get the date in Jakarta timezone
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: ASIA_JAKARTA,
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

  // Construct a new Date object that represents the same wall-clock time as Jakarta
  // This is a workaround to use date-fns format while enforcing Jakarta's time
  const jakartaDate = new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );

  return format(jakartaDate, formatStr, { locale: id });
}

/**
 * Checks if a given date is "today" in WIB.
 */
export function isWIBToday(date: Date | string | number): boolean {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(d)) return false;

  const { start, end } = getWIBTodayRange();
  const time = d.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * Returns a new Date object representing the current "wall-clock" time in Jakarta.
 * WARNING: Use primarily for display and relative calculations (e.g. start of day).
 */
export function getWIBNow(): Date {
  const now = new Date();
  const jakartaStr = now.toLocaleString('en-US', { timeZone: ASIA_JAKARTA });
  return new Date(jakartaStr);
}

/**
 * Returns the current date at the start of the day in WIB.
 * Useful for Supabase queries and "Today" filters.
 */
export function getWIBTodayRange() {
  const jakartaNow = getWIBNow();
  
  const start = new Date(jakartaNow);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(jakartaNow);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Utility to get start of month in WIB.
 */
export function getWIBStartOfMonth() {
  const now = getWIBNow();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Calculates the difference in days between two WIB dates.
 */
export function differenceInDaysWIB(dateLeft: Date | string, dateRight: Date | string): number {
  const left = typeof dateLeft === 'string' ? new Date(dateLeft) : dateLeft;
  const right = typeof dateRight === 'string' ? new Date(dateRight) : dateRight;
  
  // Convert to Jakarta wall-clock time for accurate local day diff
  const leftWIB = new Date(left.toLocaleString('en-US', { timeZone: ASIA_JAKARTA }));
  const rightWIB = new Date(right.toLocaleString('en-US', { timeZone: ASIA_JAKARTA }));
  
  const diffTime = Math.abs(leftWIB.getTime() - rightWIB.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns a human-friendly string for "Today", "Yesterday", or the date in WIB.
 */
export function formatRelativeWIB(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  
  if (isWIBToday(d)) {
    return `Hari Ini, ${formatWIB(d, 'HH:mm')}`;
  }
  
  const { start: todayStart } = getWIBTodayRange();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);
  yesterdayEnd.setMilliseconds(-1);
  
  const time = d.getTime();
  if (time >= yesterdayStart.getTime() && time <= yesterdayEnd.getTime()) {
    return `Kemarin, ${formatWIB(d, 'HH:mm')}`;
  }
  
  return formatWIB(d, 'dd MMM yyyy, HH:mm');
}
