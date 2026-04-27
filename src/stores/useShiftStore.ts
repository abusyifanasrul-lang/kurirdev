import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  is_active: boolean;
}

interface ShiftStore {
  shifts: Shift[];
  isLoading: boolean;
  fetchShifts: () => Promise<void>;
  addShift: (data: Omit<Shift, 'id'>) => Promise<void>;
  updateShift: (id: string, data: Partial<Shift>) => Promise<void>;
}

export const useShiftStore = create<ShiftStore>((set, get) => ({
  shifts: [],
  isLoading: false,

  fetchShifts: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time');
    if (!error && data) set({ shifts: data });
    set({ isLoading: false });
  },

  addShift: async (data) => {
    const { error } = await supabase.from('shifts').insert(data);
    if (!error) await get().fetchShifts();
  },

  updateShift: async (id, data) => {
    const { error } = await supabase
      .from('shifts').update(data).eq('id', id);
    if (!error) await get().fetchShifts();
  },
}));
