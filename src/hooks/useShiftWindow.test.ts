import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useShiftWindow } from './useShiftWindow';
import { supabase } from '@/lib/supabaseClient';

// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('useShiftWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current time to 2024-01-15 07:30:00 Asia/Makassar
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T07:30:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Shift Window Calculation', () => {
    it('should return emerald color when within shift window (1 hour before start)', async () => {
      const mockShift = {
        id: 'shift-1',
        name: 'Shift Pagi',
        start_time: '08:00:00',
        end_time: '17:00:00',
        is_overnight: false,
      };

      const mockSettings = {
        operational_timezone: 'Asia/Makassar',
        check_in_window_minutes: 60,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockShift, error: null }),
          }),
        }),
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(true);
        expect(result.current.buttonColor).toBe('emerald');
      });
    });

    it('should return yellow color when outside shift window', async () => {
      const mockShift = {
        id: 'shift-1',
        name: 'Shift Pagi',
        start_time: '08:00:00',
        end_time: '17:00:00',
        is_overnight: false,
      };

      const mockSettings = {
        operational_timezone: 'Asia/Makassar',
        check_in_window_minutes: 60,
      };

      // Current time: 07:30, shift starts at 08:00, window opens at 07:00
      // But let's set time to 06:30 (before window)
      vi.setSystemTime(new Date('2024-01-15T06:30:00+08:00'));

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockShift, error: null }),
          }),
        }),
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(false);
        expect(result.current.buttonColor).toBe('yellow');
      });
    });

    it('should handle overnight shifts correctly', async () => {
      const mockShift = {
        id: 'shift-2',
        name: 'Shift Malam',
        start_time: '18:00:00',
        end_time: '02:00:00',
        is_overnight: true,
      };

      const mockSettings = {
        operational_timezone: 'Asia/Makassar',
        check_in_window_minutes: 60,
      };

      // Set time to 01:00 (within overnight shift window)
      vi.setSystemTime(new Date('2024-01-16T01:00:00+08:00'));

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockShift, error: null }),
          }),
        }),
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(true);
        expect(result.current.buttonColor).toBe('emerald');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return yellow when courier has no shift assigned', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(false);
        expect(result.current.buttonColor).toBe('yellow');
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(false);
        expect(result.current.buttonColor).toBe('yellow');
      });
    });
  });

  describe('Timezone Handling', () => {
    it('should correctly handle Asia/Makassar timezone (UTC+8)', async () => {
      const mockShift = {
        id: 'shift-1',
        name: 'Shift Pagi',
        start_time: '06:00:00',
        end_time: '17:00:00',
        is_overnight: false,
      };

      const mockSettings = {
        operational_timezone: 'Asia/Makassar',
        check_in_window_minutes: 60,
      };

      // Set UTC time that corresponds to 05:30 Asia/Makassar (within window)
      vi.setSystemTime(new Date('2024-01-14T21:30:00Z')); // 05:30 +08:00

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockShift, error: null }),
          }),
        }),
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
        }),
      } as any);

      const { result } = renderHook(() => useShiftWindow('courier-1'));

      await waitFor(() => {
        expect(result.current.isWithinWindow).toBe(true);
      });
    });
  });
});
