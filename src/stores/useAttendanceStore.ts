import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';

interface AttendanceLog {
  id: string;
  courier_id: string;
  date: string;
  first_online_at: string | null;
  last_online_at: string | null;
  status: 'on_time' | 'late' | 'late_minor' | 'late_major' | 'alpha' | 'sick' | 'off';
  late_minutes: number;
  flat_fine: number;
  payment_status: 'unpaid' | 'paid';
  shift_name?: string;
  shift_start?: string;
  shift_end?: string;
}

interface AttendanceStore {
  todayLog: AttendanceLog | null;
  unpaidAttendance: AttendanceLog[];
  isLoading: boolean;
  fetchTodayLog: (courierId: string) => Promise<void>;
  fetchUnpaidAttendance: () => Promise<void>;
  fetchCourierAttendance: (courierId: string, limit?: number) => Promise<AttendanceLog[]>;
  settleAttendance: (id: string, adminId: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  todayLog: null,
  unpaidAttendance: [],
  isLoading: false,

  fetchTodayLog: async (courierId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shift_attendance')
      .select('*, shifts(*)')
      .eq('courier_id', courierId)
      .is('last_online_at', null)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      set({ todayLog: {
        ...data,
        shift_name: data.shifts?.name,
        shift_start: data.shifts?.start_time,
        shift_end: data.shifts?.end_time
      } });
    } else {
      set({ todayLog: null });
    }
    set({ isLoading: false });
  },

  fetchCourierAttendance: async (courierId, limit = 20) => {
    const { data, error } = await supabase
      .from('shift_attendance')
      .select('*, shifts(name)')
      .eq('courier_id', courierId)
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) return [];
    return data.map((d: any) => ({
      ...d,
      shift_name: d.shifts?.name
    }));
  },

  fetchUnpaidAttendance: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shift_attendance')
      .select('*, shifts(name)')
      .eq('payment_status', 'unpaid')
      .gt('flat_fine', 0);
    
    if (!error && data) {
      set({ unpaidAttendance: data.map((d: any) => ({
        ...d,
        shift_name: d.shifts?.name
      })) });
    }
    set({ isLoading: false });
  },

  settleAttendance: async (id, adminId) => {
    const { error } = await supabase.rpc('settle_attendance_fine', {
      p_attendance_id: id,
      p_admin_id: adminId
    });
    
    if (!error) {
      await get().fetchUnpaidAttendance();
    }
  }
}));
