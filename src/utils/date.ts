import { isValid, parseISO, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
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
 * Uses date-fns-tz to ensure the timezone is correctly handled.
 */
export function formatLocal(
  date: Date | string | number | null | undefined,
  formatStr: string = 'dd MMM yyyy, HH:mm'
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(d)) return '-';

  const tz = getTimezone();

  // Use date-fns-tz to format in the operational timezone
  return formatInTimeZone(d, tz, formatStr, { locale: id });
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
 * Returns a new Date object representing the current time in operational timezone.
 * Uses date-fns-tz for reliable timezone conversion.
 * 
 * IMPORTANT: This returns a Date object representing the current moment in time,
 * converted to the operational timezone for display/calculation purposes.
 */
export function getLocalNow(): Date {
  const now = new Date();
  const tz = getTimezone();
  
  // Convert UTC time to operational timezone
  return toZonedTime(now, tz);
}

/**
 * Returns the current date at the start and end of the day in operational timezone.
 * Uses date-fns-tz to ensure correct timezone handling.
 * Useful for Supabase queries and "Today" filters.
 */
export function getLocalTodayRange() {
  const tz = getTimezone();
  const now = new Date();
  
  // Convert current UTC time to operational timezone
  const zonedNow = toZonedTime(now, tz);
  
  // Get start and end of day in the operational timezone
  const zonedStart = startOfDay(zonedNow);
  const zonedEnd = endOfDay(zonedNow);
  
  // Convert back to UTC for storage/comparison
  const start = fromZonedTime(zonedStart, tz);
  const end = fromZonedTime(zonedEnd, tz);
  
  return { start, end };
}

/**
 * Formats a Date object to YYYY-MM-DD string in operational timezone.
 * Uses date-fns-tz to ensure correct timezone handling.
 * 
 * CRITICAL: Use this for all date comparisons with database DATE columns.
 */
export function formatDateLocal(date: Date): string {
  const tz = getTimezone();
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/**
 * Returns today's date as YYYY-MM-DD string in operational timezone.
 * Uses date-fns-tz to ensure correct timezone handling.
 * Convenience wrapper for formatDateLocal(new Date()).
 */
export function getTodayLocal(): string {
  const tz = getTimezone();
  const now = new Date();
  return formatInTimeZone(now, tz, 'yyyy-MM-dd');
}

/**
 * Utility to get start of month in operational timezone.
 * Uses date-fns-tz to ensure correct timezone handling.
 */
export function getLocalStartOfMonth() {
  const tz = getTimezone();
  const now = new Date();
  
  // Convert to operational timezone
  const zonedNow = toZonedTime(now, tz);
  
  // Set to first day of month at midnight
  zonedNow.setDate(1);
  zonedNow.setHours(0, 0, 0, 0);
  
  // Convert back to UTC
  return fromZonedTime(zonedNow, tz);
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

/**
 * Get start and end of a specific day in operational timezone.
 * Uses date-fns-tz to ensure correct timezone handling.
 * 
 * This utility takes a Date object and returns the boundaries (00:00:00 and 23:59:59.999)
 * for that day in the operational timezone, returned as Date objects representing
 * the correct UTC timestamps.
 * 
 * @param date - The date to get boundaries for
 * @returns { start: Date, end: Date } - Day boundaries in operational timezone
 * 
 * @example
 * const date = new Date('2026-05-31');
 * const { start, end } = getLocalDayRange(date);
 * // start: 2026-05-31 00:00:00 Makassar (2026-05-30 16:00:00 UTC)
 * // end: 2026-05-31 23:59:59.999 Makassar (2026-05-31 15:59:59.999 UTC)
 */
export function getLocalDayRange(date: Date): { start: Date; end: Date } {
  const tz = getTimezone();
  
  // Convert the date to operational timezone
  const zonedDate = toZonedTime(date, tz);
  
  // Get start and end of day in operational timezone
  const zonedStart = startOfDay(zonedDate);
  const zonedEnd = endOfDay(zonedDate);
  
  // Convert back to UTC for storage/comparison
  const start = fromZonedTime(zonedStart, tz);
  const end = fromZonedTime(zonedEnd, tz);
  
  return { start, end };
}
