import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  formatLocal, 
  isLocalToday, 
  getLocalNow, 
  getLocalTodayRange, 
  differenceInDaysLocal, 
  formatRelativeLocal 
} from './date'

describe('WIB Date Utilities', () => {
  // Use a fixed system time for consistent testing
  // Sat Apr 04 2026 12:00:00 UTC = Sat Apr 04 2026 19:00:00 WIB
  const MOCK_DATE = new Date('2026-04-04T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatLocal', () => {
    it('should format UTC date string to WIB directly', () => {
      const utcDate = '2026-04-04T10:00:00Z' // 10:00 UTC
      // 10:00 UTC + 7h = 17:00 WIB
      expect(formatLocal(utcDate, 'HH:mm')).toBe('17:00')
    })

    it('should handle dates that cross over the day boundary in WIB', () => {
      const utcDate = '2026-04-04T20:00:00Z' // 20:00 UTC on 4th
      // 20:00 UTC + 7h = 03:00 WIB on 5th
      expect(formatLocal(utcDate, 'dd MMM yyyy, HH:mm')).toBe('05 Apr 2026, 03:00')
    })

    it('should return "-" for null or undefined', () => {
      expect(formatLocal(null)).toBe('-')
      expect(formatLocal(undefined)).toBe('-')
    })

    it('should return "-" for invalid dates', () => {
      expect(formatLocal('invalid-date')).toBe('-')
    })
  })

  describe('isLocalToday', () => {
    it('should return true for a date within today WIB', () => {
      // System time is Sat Apr 04 2026 19:00 WIB
      const todayWIB = '2026-04-04T10:00:00Z' // 17:00 WIB
      expect(isLocalToday(todayWIB)).toBe(true)
    })

    it('should return false for a date that is tomorrow in WIB', () => {
      // System is at 19:00 WIB on 4th. 21:00 UTC is 04:00 WIB on 5th.
      const tomorrowWIB = '2026-04-04T21:00:00Z' 
      expect(isLocalToday(tomorrowWIB)).toBe(false)
    })
  })

  describe('getLocalNow', () => {
    it('should return a date that matches Jakarta wall-clock time', () => {
      // Mock system is 12:00 UTC / 19:00 WIB
      const nowWIB = getLocalNow()
      expect(nowWIB.getHours()).toBe(19)
    })
  })

  describe('getLocalTodayRange', () => {
    it('should return start and end of day in WIB in terms of absolute timestamps', () => {
      const { start, end } = getLocalTodayRange()
      
      // Start should be 04 Apr 2026 00:00 WIB = 03 Apr 17:00 UTC
      expect(start.toISOString()).toBe('2026-04-03T17:00:00.000Z')
      
      // End should be 04 Apr 2026 23:59:59.999 WIB = 04 Apr 16:59:59.999 UTC
      expect(end.toISOString()).toBe('2026-04-04T16:59:59.999Z')
    })
  })

  describe('differenceInDaysLocal', () => {
    it('should return 1 for one day difference in WIB', () => {
      const day1 = '2026-04-04T10:00:00Z' // 17:00 WIB 4th
      const day2 = '2026-04-05T10:00:00Z' // 17:00 WIB 5th
      expect(differenceInDaysLocal(day1, day2)).toBe(1)
    })

    it('should return 0 for same day in WIB even if UTC dates differ', () => {
      const lateUTC4th = '2026-04-04T23:00:00Z' // 06:00 WIB 5th
      const earlyUTC5th = '2026-04-05T01:00:00Z' // 08:00 WIB 5th
      expect(differenceInDaysLocal(lateUTC4th, earlyUTC5th)).toBe(0)
    })
  })

  describe('formatRelativeLocal', () => {
    it('should return "Hari Ini, HH:mm" for today in WIB', () => {
      const today = '2026-04-04T10:00:00Z' // 17:00 WIB
      expect(formatRelativeLocal(today)).toBe('Hari Ini, 17:00')
    })

    it('should return "Kemarin, HH:mm" for yesterday in WIB', () => {
      const yesterday = '2026-04-03T10:00:00Z' // 17:00 WIB yesterday
      expect(formatRelativeLocal(yesterday)).toBe('Kemarin, 17:00')
    })

    it('should return full date for older dates', () => {
      const oldDate = '2026-04-01T10:00:00Z' // 01 Apr
      expect(formatRelativeLocal(oldDate)).toBe('01 Apr 2026, 17:00')
    })
  })
})
