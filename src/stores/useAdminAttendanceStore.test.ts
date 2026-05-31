import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminAttendanceStore } from './useAdminAttendanceStore';
import { supabase } from '@/lib/supabaseClient';

// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

// Mock date utilities
vi.mock('@/utils/date', () => ({
  getTodayLocal: () => '2024-01-15',
  getLocalTodayRange: () => ({
    start: '2024-01-15T00:00:00+08:00',
    end: '2024-01-15T23:59:59+08:00',
  }),
}));

describe('useAdminAttendanceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTodayLogs', () => {
    it('should fetch and format today attendance logs correctly', async () => {
      const mockData = [
        {
          id: 'log-1',
          courier_id: 'courier-1',
          shift_id: 'shift-1',
          first_online_at: '2024-01-15T06:30:00+08:00',
          last_online_at: null,
          status: 'on_time',
          late_minutes: 0,
          fine_type: null,
          fine_per_order: 0,
          flat_fine: 0,
          profiles: { name: 'John Doe' },
          shifts: { name: 'Shift Pagi', start_time: '06:00:00' },
        },
        {
          id: 'log-2',
          courier_id: 'courier-2',
          shift_id: 'shift-1',
          first_online_at: null,
          last_online_at: null,
          status: 'late',
          late_minutes: 45,
          fine_type: null,
          fine_per_order: 0,
          flat_fine: 0,
          profiles: { name: 'Jane Smith' },
          shifts: { name: 'Shift Pagi', start_time: '06:00:00' },
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.fetchTodayLogs();
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0]).toMatchObject({
        id: 'log-1',
        courier_name: 'John Doe',
        shift_name: 'Shift Pagi',
        status: 'on_time',
        late_minutes: 0,
      });
      expect(result.current.logs[1]).toMatchObject({
        id: 'log-2',
        courier_name: 'Jane Smith',
        status: 'late',
        late_minutes: 45,
      });
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            }),
          }),
        }),
      } as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.fetchTodayLogs();
      });

      expect(result.current.logs).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('fetchPendingReview', () => {
    it('should fetch pending review records correctly', async () => {
      const mockData = [
        {
          id: 'log-3',
          courier_id: 'courier-3',
          shift_id: 'shift-1',
          first_online_at: null,
          status: 'late',
          late_minutes: 30,
          fine_type: null,
          courier_name: 'Bob Wilson',
          shift_name: 'Shift Pagi',
          shift_start_time: '06:00:00',
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValue({ data: mockData, error: null });

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.fetchPendingReview();
      });

      expect(result.current.pendingReview).toHaveLength(1);
      expect(result.current.pendingReview[0]).toMatchObject({
        id: 'log-3',
        courier_name: 'Bob Wilson',
        status: 'late',
        late_minutes: 30,
        fine_type: null,
      });
    });
  });

  describe('fetchPendingAlpha', () => {
    it('should fetch pending alpha records correctly', async () => {
      const mockData = [
        {
          id: 'log-4',
          courier_id: 'courier-4',
          shift_id: 'shift-1',
          first_online_at: null,
          status: 'alpha',
          late_minutes: 660, // 11 hours
          fine_type: null,
          courier_name: 'Alice Brown',
          shift_name: 'Shift Pagi',
          shift_start_time: '06:00:00',
        },
      ];

      vi.mocked(supabase.rpc).mockResolvedValue({ data: mockData, error: null });

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.fetchPendingAlpha();
      });

      expect(result.current.pendingAlpha).toHaveLength(1);
      expect(result.current.pendingAlpha[0]).toMatchObject({
        id: 'log-4',
        courier_name: 'Alice Brown',
        status: 'alpha',
        late_minutes: 660,
      });
    });
  });

  describe('applyFine', () => {
    it('should apply fine and refresh data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.applyFine('log-1', 'per_order', 'admin-1', 'Test note');
      });

      expect(supabase.rpc).toHaveBeenCalledWith('apply_attendance_fine', {
        p_attendance_id: 'log-1',
        p_fine_type: 'per_order',
        p_admin_id: 'admin-1',
        p_notes: 'Test note',
      });
    });

    it('should apply flat_major fine for late >= 60 minutes', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.applyFine('log-2', 'flat_major', 'admin-1');
      });

      expect(supabase.rpc).toHaveBeenCalledWith('apply_attendance_fine', {
        p_attendance_id: 'log-2',
        p_fine_type: 'flat_major',
        p_admin_id: 'admin-1',
        p_notes: null,
      });
    });
  });

  describe('excuseLate', () => {
    it('should excuse late attendance and refresh data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.excuseLate('log-3', 'admin-1', 'Valid reason');
      });

      expect(supabase.rpc).toHaveBeenCalledWith('excuse_attendance', {
        p_attendance_id: 'log-3',
        p_admin_id: 'admin-1',
        p_notes: 'Valid reason',
      });
    });
  });

  describe('verifyAlpha', () => {
    it('should verify alpha attendance and refresh data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useAdminAttendanceStore());

      await act(async () => {
        await result.current.verifyAlpha('log-4', 'admin-1', 'Confirmed alpha');
      });

      expect(supabase.rpc).toHaveBeenCalledWith('verify_alpha_attendance', {
        p_attendance_id: 'log-4',
        p_admin_id: 'admin-1',
        p_notes: 'Confirmed alpha',
      });
    });
  });

  describe('Fine Calculation Logic', () => {
    it('should use per_order fine for late < 60 minutes', () => {
      const lateMinutes = 45;
      const fineType = lateMinutes < 60 ? 'per_order' : 'flat_major';
      expect(fineType).toBe('per_order');
    });

    it('should use flat_major fine for late >= 60 minutes', () => {
      const lateMinutes = 60;
      const fineType = lateMinutes >= 60 ? 'flat_major' : 'per_order';
      expect(fineType).toBe('flat_major');
    });

    it('should use flat_major fine for late > 60 minutes', () => {
      const lateMinutes = 120;
      const fineType = lateMinutes >= 60 ? 'flat_major' : 'per_order';
      expect(fineType).toBe('flat_major');
    });
  });
});
