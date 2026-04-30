import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';

interface AdminAttendanceLog {
  id: string;
  courier_id: string;
  shift_id: string;
  first_online_at: string | null;  // nama sesuai DB
  last_online_at: string | null;
  status: 'on_time' | 'late' | 'late_minor' | 'late_major' | 'alpha' | 'excused';
  late_minutes: number;
  fine_type: string | null;
  fine_per_order: number;
  flat_fine: number;
  courier_name?: string;
  shift_name?: string;
  shift_start_time?: string;
}

interface MissingCourier {
  courier_id: string;
  courier_name: string;
  shift_id: string;
  shift_name: string;
  shift_start_time: string;
  minutes_late: number;
}

interface AdminAttendanceStore {
  logs: AdminAttendanceLog[];
  missingCouriers: MissingCourier[];
  isLoading: boolean;
  fetchTodayLogs: () => Promise<void>;
  fetchMissingCouriers: () => Promise<void>;
  applyFine: (attendanceId: string, fineType: 'per_order' | 'flat_major', adminId: string) => Promise<void>;
  excuseLate: (attendanceId: string, adminId: string, notes?: string) => Promise<void>;
  subscribeToday: () => (() => void);
}

export const useAdminAttendanceStore = create<AdminAttendanceStore>((set, get) => ({
  logs: [],
  missingCouriers: [],
  isLoading: false,

  fetchTodayLogs: async () => {
    // Step 5: Reset harian late_fine_active
    const lastReset = localStorage.getItem('last_fine_reset');
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastReset !== todayStr) {
      await supabase.rpc('reset_daily_fine_flags');
      localStorage.setItem('last_fine_reset', todayStr);
    }

    set({ isLoading: true });
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('shift_attendance')
      .select(`
        *,
        profiles:courier_id(name),
        shifts(name, start_time)
      `)
      .eq('date', today)
      .order('first_online_at', { ascending: false });

    if (!error && data) {
      set({
        logs: data.map((log: any) => ({
          id: log.id,
          courier_id: log.courier_id,
          shift_id: log.shift_id,
          first_online_at: log.first_online_at,
          last_online_at: log.last_online_at,
          status: log.status,
          late_minutes: log.late_minutes ?? 0,
          fine_type: log.fine_type,
          fine_per_order: log.fine_per_order ?? 0,
          flat_fine: log.flat_fine ?? 0,
          courier_name: log.profiles?.name,
          shift_name: log.shifts?.name,
          shift_start_time: log.shifts?.start_time,
        }))
      });
    }
    set({ isLoading: false });
  },

  fetchMissingCouriers: async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.rpc('get_missing_couriers', { p_date: today });
    if (!error && data) {
      set({ missingCouriers: data });
    }
  },

  applyFine: async (attendanceId, fineType, adminId) => {
    const { error } = await supabase.rpc('apply_attendance_fine', {
      p_attendance_id: attendanceId,
      p_fine_type: fineType,
      p_admin_id: adminId,
    });
    if (!error) await get().fetchTodayLogs();
  },

  excuseLate: async (attendanceId, adminId, notes) => {
    const { error } = await supabase.rpc('excuse_attendance', {
      p_attendance_id: attendanceId,
      p_admin_id: adminId,
      p_notes: notes ?? null,
    });
    if (!error) await get().fetchTodayLogs();
  },

  subscribeToday: () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const channel = supabase
      .channel('attendance-today')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shift_attendance',
        filter: `date=eq.${today}`,  // ✅ hanya trigger untuk hari ini
      }, () => {
        // Saat ada perubahan attendance, refresh keduanya
        get().fetchTodayLogs();
        get().fetchMissingCouriers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
