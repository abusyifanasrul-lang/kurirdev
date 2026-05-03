import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { 
  Plus, 
  Clock, 
  Moon, 
  Sun, 
  MoreVertical, 
  Edit2, 
  Power,
  Search,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users,
  X,
  UserPlus,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useShiftStore } from '@/stores/useShiftStore';
import { useUserStore } from '@/stores/useUserStore';
import { useToastStore } from '@/stores/useToastStore';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/utils/cn';

interface ShiftFormData {
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  is_active: boolean;
}

interface ShiftSwapFormData {
  date: string;
  courier1_id: string;
  courier2_id: string;
}

interface ShiftSwap {
  date: string;
  courier1: { id: string; name: string; shift_id: string; shift_name: string };
  courier2: { id: string; name: string; shift_id: string; shift_name: string };
}

const initialFormData: ShiftFormData = {
  name: '',
  start_time: '08:00',
  end_time: '17:00',
  is_overnight: false,
  is_active: true,
};

const initialSwapFormData: ShiftSwapFormData = {
  date: '',
  courier1_id: '',
  courier2_id: '',
};

export default function Shifts() {
  const { shifts, isLoading, fetchShifts, addShift, updateShift } = useShiftStore();
  const { users, updateUser, fetchUsers } = useUserStore();
  const { addToast } = useToastStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<string | null>(null);
  const [selectedCouriersToAssign, setSelectedCouriersToAssign] = useState<string[]>([]);
  
  // Shift Swap states
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isSwapListModalOpen, setIsSwapListModalOpen] = useState(false);
  const [swapFormData, setSwapFormData] = useState<ShiftSwapFormData>(initialSwapFormData);
  const [shiftSwaps, setShiftSwaps] = useState<ShiftSwap[]>([]);
  const [isLoadingSwaps, setIsLoadingSwaps] = useState(false);

  const couriers = useMemo(() => {
    const filtered = users.filter(u => u.role === 'courier');
    return filtered;
  }, [users]);

  const getCouriersByShift = (shiftId: string) => {
    const filtered = couriers.filter(c => c.shift_id === shiftId);
    return filtered;
  };

  const getUnassignedCouriers = () => {
    return couriers.filter(c => !c.shift_id || c.shift_id === null);
  };

  useEffect(() => {
    fetchShifts();
    fetchUsers();
  }, [fetchShifts, fetchUsers]);

  const handleUnassignCourier = async (courierId: string, courierName: string) => {
    const loadingToast = addToast(`Melepas ${courierName} dari shift...`, 'loading', 0);

    try {
      const result = await updateUser(courierId, { shift_id: null });
      if (result.success) {
        // Wait a bit for database to propagate
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Force refresh users data
        await fetchUsers();
        
        addToast(`${courierName} berhasil dilepas dari shift`, 'success', 3000);
      } else {
        throw new Error(result.error || 'Gagal melepas kurir');
      }
    } catch (error: any) {
      addToast(error.message || 'Gagal melepas kurir dari shift', 'error', 5000);
    } finally {
      useToastStore.getState().removeToast(loadingToast);
    }
  };

  const handleOpenAssignModal = (shiftId: string) => {
    setSelectedShiftForAssign(shiftId);
    setSelectedCouriersToAssign([]);
    setIsAssignModalOpen(true);
  };

  const handleAssignCouriers = async () => {
    if (!selectedShiftForAssign || selectedCouriersToAssign.length === 0) return;

    const shift = shifts.find(s => s.id === selectedShiftForAssign);
    const loadingToast = addToast(`Meng-assign ${selectedCouriersToAssign.length} kurir ke ${shift?.name}...`, 'loading', 0);

    try {
      // Update all couriers
      const results = await Promise.all(
        selectedCouriersToAssign.map(courierId =>
          updateUser(courierId, { shift_id: selectedShiftForAssign })
        )
      );

      // Check if all succeeded
      const allSuccess = results.every(r => r.success);
      if (!allSuccess) {
        throw new Error('Beberapa kurir gagal di-assign');
      }

      // Wait a bit for database to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force refresh users data
      await fetchUsers();

      addToast(`${selectedCouriersToAssign.length} kurir berhasil di-assign ke ${shift?.name}`, 'success', 3000);

      setIsAssignModalOpen(false);
      setSelectedCouriersToAssign([]);
      setSelectedShiftForAssign(null);
    } catch (error: any) {
      console.error('[Shifts] Assign error:', error);
      addToast(error.message || 'Gagal meng-assign kurir', 'error', 5000);
    } finally {
      useToastStore.getState().removeToast(loadingToast);
    }
  };

  const toggleCourierSelection = (courierId: string) => {
    setSelectedCouriersToAssign(prev =>
      prev.includes(courierId)
        ? prev.filter(id => id !== courierId)
        : [...prev, courierId]
    );
  };

  // Shift Swap Functions
  const fetchShiftSwaps = async () => {
    setIsLoadingSwaps(true);
    try {
      const { data, error } = await supabase
        .from('shift_overrides')
        .select(`
          date,
          original_courier_id,
          replacement_courier_id,
          original_shift_id
        `)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        // Group pairs of swaps
        const swapMap = new Map<string, any>();
        
        data.forEach(record => {
          const key = `${record.date}-${[record.original_courier_id, record.replacement_courier_id].sort().join('-')}`;
          
          if (!swapMap.has(key)) {
            swapMap.set(key, {
              date: record.date,
              records: [record]
            });
          } else {
            swapMap.get(key).records.push(record);
          }
        });

        // Convert to ShiftSwap format
        const swaps: ShiftSwap[] = [];
        swapMap.forEach(({ date, records }) => {
          if (records.length === 2) {
            const courier1 = users.find(u => u.id === records[0].original_courier_id);
            const courier2 = users.find(u => u.id === records[0].replacement_courier_id);
            const shift1 = shifts.find(s => s.id === courier1?.shift_id);
            const shift2 = shifts.find(s => s.id === courier2?.shift_id);

            if (courier1 && courier2 && shift1 && shift2) {
              swaps.push({
                date,
                courier1: {
                  id: courier1.id,
                  name: courier1.name,
                  shift_id: shift1.id,
                  shift_name: shift1.name
                },
                courier2: {
                  id: courier2.id,
                  name: courier2.name,
                  shift_id: shift2.id,
                  shift_name: shift2.name
                }
              });
            }
          }
        });

        setShiftSwaps(swaps);
      }
    } catch (error: any) {
      console.error('Error fetching shift swaps:', error);
      addToast('Gagal memuat data tukar shift', 'error', 3000);
    } finally {
      setIsLoadingSwaps(false);
    }
  };

  const handleOpenSwapModal = () => {
    setSwapFormData(initialSwapFormData);
    setIsSwapModalOpen(true);
  };

  const handleOpenSwapListModal = () => {
    fetchShiftSwaps();
    setIsSwapListModalOpen(true);
  };

  const handleSaveSwap = async () => {
    const { date, courier1_id, courier2_id } = swapFormData;

    // Validation
    if (!date || !courier1_id || !courier2_id) {
      addToast('Semua field harus diisi', 'error', 3000);
      return;
    }

    if (courier1_id === courier2_id) {
      addToast('Tidak bisa tukar shift dengan kurir yang sama', 'error', 3000);
      return;
    }

    const courier1 = couriers.find(c => c.id === courier1_id);
    const courier2 = couriers.find(c => c.id === courier2_id);

    if (!courier1?.shift_id || !courier2?.shift_id) {
      addToast('Kedua kurir harus memiliki shift', 'error', 3000);
      return;
    }

    if (courier1.shift_id === courier2.shift_id) {
      addToast('Kurir harus dari shift yang berbeda', 'error', 3000);
      return;
    }

    // Check if date is in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      addToast('Tidak bisa tukar shift untuk tanggal yang sudah lewat', 'error', 3000);
      return;
    }

    // Check for existing swaps on the same date
    const { data: existingSwaps, error: checkError } = await supabase
      .from('shift_overrides')
      .select('*')
      .eq('date', date)
      .or(`original_courier_id.eq.${courier1_id},original_courier_id.eq.${courier2_id},replacement_courier_id.eq.${courier1_id},replacement_courier_id.eq.${courier2_id}`);

    if (checkError) {
      addToast('Gagal memeriksa data tukar shift', 'error', 3000);
      return;
    }

    if (existingSwaps && existingSwaps.length > 0) {
      addToast('Salah satu kurir sudah memiliki tukar shift di tanggal ini', 'error', 3000);
      return;
    }

    const loadingToast = addToast('Menyimpan tukar shift...', 'loading', 0);

    try {
      const shift1 = shifts.find(s => s.id === courier1.shift_id);
      const shift2 = shifts.find(s => s.id === courier2.shift_id);

      // Insert 2 records for the swap
      const { error } = await supabase.from('shift_overrides').insert([
        {
          date,
          original_courier_id: courier1_id,
          replacement_courier_id: courier2_id,
          original_shift_id: courier1.shift_id
        },
        {
          date,
          original_courier_id: courier2_id,
          replacement_courier_id: courier1_id,
          original_shift_id: courier2.shift_id
        }
      ]);

      if (error) throw error;

      // Send immediate notifications to both couriers
      const formattedDate = new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // Notification for courier 1
      await supabase.from('notifications').insert({
        user_id: courier1_id,
        user_name: courier1.name,
        title: '🔄 Tukar Shift',
        message: `Anda bertukar shift dengan ${courier2.name} pada ${formattedDate}. Anda akan masuk ${shift2?.name} (${shift2?.start_time.substring(0, 5)}-${shift2?.end_time.substring(0, 5)}).`,
        type: 'shift_swap',
        data: {
          type: 'shift_swap',
          date,
          partner_id: courier2_id,
          partner_name: courier2.name,
          original_shift: shift1?.name,
          new_shift: shift2?.name
        },
        is_read: false,
        fcm_status: 'pending'
      });

      // Notification for courier 2
      await supabase.from('notifications').insert({
        user_id: courier2_id,
        user_name: courier2.name,
        title: '🔄 Tukar Shift',
        message: `Anda bertukar shift dengan ${courier1.name} pada ${formattedDate}. Anda akan masuk ${shift1?.name} (${shift1?.start_time.substring(0, 5)}-${shift1?.end_time.substring(0, 5)}).`,
        type: 'shift_swap',
        data: {
          type: 'shift_swap',
          date,
          partner_id: courier1_id,
          partner_name: courier1.name,
          original_shift: shift2?.name,
          new_shift: shift1?.name
        },
        is_read: false,
        fcm_status: 'pending'
      });

      // Schedule reminder notifications (1 hour before shift starts)
      // Courier 1 reminder (for shift 2)
      if (shift2) {
        const reminderTime1 = new Date(`${date}T${shift2.start_time}`);
        reminderTime1.setHours(reminderTime1.getHours() - 1); // 1 hour before

        await supabase.from('scheduled_notifications').insert({
          user_id: courier1_id,
          scheduled_at: reminderTime1.toISOString(),
          title: '⏰ Pengingat Tukar Shift',
          message: `Halo ${courier1.name}! Ingat ya, hari ini Anda tukar shift dengan ${courier2.name}. Shift Anda dimulai jam ${shift2.start_time.substring(0, 5)} (${shift2.name}). Jangan lupa check-in!`,
          type: 'shift_swap_reminder',
          data: {
            type: 'shift_swap_reminder',
            date,
            shift_id: shift2.id,
            shift_name: shift2.name,
            shift_start: shift2.start_time,
            partner_name: courier2.name
          }
        });
      }

      // Courier 2 reminder (for shift 1)
      if (shift1) {
        const reminderTime2 = new Date(`${date}T${shift1.start_time}`);
        reminderTime2.setHours(reminderTime2.getHours() - 1); // 1 hour before

        await supabase.from('scheduled_notifications').insert({
          user_id: courier2_id,
          scheduled_at: reminderTime2.toISOString(),
          title: '⏰ Pengingat Tukar Shift',
          message: `Halo ${courier2.name}! Ingat ya, hari ini Anda tukar shift dengan ${courier1.name}. Shift Anda dimulai jam ${shift1.start_time.substring(0, 5)} (${shift1.name}). Jangan lupa check-in!`,
          type: 'shift_swap_reminder',
          data: {
            type: 'shift_swap_reminder',
            date,
            shift_id: shift1.id,
            shift_name: shift1.name,
            shift_start: shift1.start_time,
            partner_name: courier1.name
          }
        });
      }

      addToast('Tukar shift berhasil disimpan', 'success', 3000);
      setIsSwapModalOpen(false);
      setSwapFormData(initialSwapFormData);
      
      // Refresh list if list modal is open
      if (isSwapListModalOpen) {
        fetchShiftSwaps();
      }
    } catch (error: any) {
      console.error('Error saving shift swap:', error);
      addToast(error.message || 'Gagal menyimpan tukar shift', 'error', 5000);
    } finally {
      useToastStore.getState().removeToast(loadingToast);
    }
  };

  const handleDeleteSwap = async (date: string, courier1_id: string, courier2_id: string) => {
    const loadingToast = addToast('Menghapus tukar shift...', 'loading', 0);

    try {
      const { error } = await supabase
        .from('shift_overrides')
        .delete()
        .eq('date', date)
        .in('original_courier_id', [courier1_id, courier2_id]);

      if (error) throw error;

      addToast('Tukar shift berhasil dihapus', 'success', 3000);
      fetchShiftSwaps(); // Refresh list
    } catch (error: any) {
      console.error('Error deleting shift swap:', error);
      addToast(error.message || 'Gagal menghapus tukar shift', 'error', 5000);
    } finally {
      useToastStore.getState().removeToast(loadingToast);
    }
  };

  const getSwapPreview = () => {
    const { courier1_id, courier2_id, date } = swapFormData;
    if (!courier1_id || !courier2_id || !date) return null;

    const courier1 = couriers.find(c => c.id === courier1_id);
    const courier2 = couriers.find(c => c.id === courier2_id);
    const shift1 = shifts.find(s => s.id === courier1?.shift_id);
    const shift2 = shifts.find(s => s.id === courier2?.shift_id);

    if (!courier1 || !courier2 || !shift1 || !shift2) return null;

    const formattedDate = new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return {
      text: `${courier1.name} dan ${courier2.name} bertukar shift pada ${formattedDate}`,
      details: [
        `• ${courier1.name} → ${shift2.name} (${shift2.start_time.substring(0, 5)}-${shift2.end_time.substring(0, 5)})`,
        `• ${courier2.name} → ${shift1.name} (${shift1.start_time.substring(0, 5)}-${shift1.end_time.substring(0, 5)})`
      ]
    };
  };

  const handleOpenModal = (shift?: any) => {
    if (shift) {
      setEditingId(shift.id);
      setFormData({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        is_overnight: shift.is_overnight,
        is_active: shift.is_active,
      });
    } else {
      setEditingId(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateShift(editingId, formData);
      } else {
        await addShift(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving shift:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await updateShift(id, { is_active: !currentStatus });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-xl shadow-brand-dark/5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-cyan/10 rounded-2xl">
              <Calendar className="h-6 w-6 text-brand-cyan" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Shift</h1>
          </div>
          <p className="text-gray-500 text-sm pl-12">Atur jadwal kerja dan kelompok shift operasional kurir.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenSwapListModal}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-semibold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 group"
          >
            <RefreshCw className="h-5 w-5" />
            Tukar Shift
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-cyan text-white rounded-2xl font-semibold shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90 transition-all active:scale-95 group"
          >
            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
            Tambah Shift Baru
          </button>
        </div>
      </div>

      {/* Stats Quick View (Aesthetic touch) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-lg flex items-center gap-4 group hover:bg-white/80 transition-all">
          <div className="p-4 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
            <Sun className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Shift Aktif</p>
            <p className="text-2xl font-bold text-gray-900">{shifts.filter(s => s.is_active).length}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-lg flex items-center gap-4 group hover:bg-white/80 transition-all">
          <div className="p-4 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform">
            <Moon className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Shift Malam</p>
            <p className="text-2xl font-bold text-gray-900">{shifts.filter(s => s.is_overnight).length}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-lg flex items-center gap-4 group hover:bg-white/80 transition-all">
          <div className="p-4 bg-amber-50 rounded-2xl group-hover:scale-110 transition-transform">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Kelompok</p>
            <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/20 shadow-2xl overflow-hidden shadow-brand-dark/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Nama Shift</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Waktu Mulai</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Waktu Selesai</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Tipe</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Status</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Kurir</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-8"><div className="h-12 bg-gray-100 rounded-2xl w-full"></div></td>
                  </tr>
                ))
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="h-12 w-12 text-gray-300" />
                      <p className="text-gray-500 font-medium">Belum ada data shift.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => {
                  const shiftCouriers = getCouriersByShift(shift.id);
                  const isExpanded = expandedShiftId === shift.id;
                  
                  return (
                    <React.Fragment key={shift.id}>
                      <tr className="hover:bg-brand-cyan/5 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                              shift.is_overnight ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                            )}>
                              {shift.is_overnight ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{shift.name}</p>
                              <p className="text-xs text-gray-400 font-medium">ID: {shift.id.split('-')[0]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="px-4 py-2 bg-gray-100 rounded-xl font-mono text-sm font-bold text-gray-700 border border-gray-200/50">
                            {shift.start_time.substring(0, 5)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="px-4 py-2 bg-gray-100 rounded-xl font-mono text-sm font-bold text-gray-700 border border-gray-200/50">
                            {shift.end_time.substring(0, 5)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm",
                            shift.is_overnight 
                              ? "bg-indigo-100 text-indigo-700 border border-indigo-200" 
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          )}>
                            {shift.is_overnight ? 'Melintas Malam' : 'Normal'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <button 
                            onClick={() => toggleStatus(shift.id, shift.is_active)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                              shift.is_active 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                                : "bg-gray-100 text-gray-400 border-gray-200"
                            )}
                          >
                            {shift.is_active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <button
                            onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-xl font-bold text-sm hover:bg-teal-100 transition-all border border-teal-200"
                          >
                            <Users className="w-4 h-4" />
                            {shiftCouriers.length}
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => handleOpenModal(shift)}
                            className="p-3 text-gray-400 hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-2xl transition-all"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expandable Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-8 py-6 bg-gray-100">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  Kurir di {shift.name}
                                </h4>
                                <button
                                  onClick={() => handleOpenAssignModal(shift.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-brand-cyan text-white rounded-xl font-semibold text-sm hover:bg-brand-cyan/90 transition-all"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Assign Kurir
                                </button>
                              </div>
                              
                              {shiftCouriers.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                  <p className="text-sm">Belum ada kurir di shift ini</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {shiftCouriers.map((courier, index) => {
                                    // Alternate between green and orange
                                    const isGreen = index % 2 === 0;
                                    const bgColor = isGreen ? 'bg-emerald-100' : 'bg-orange-100';
                                    const textColor = isGreen ? 'text-emerald-700' : 'text-orange-700';
                                    const hoverBorder = isGreen ? 'hover:border-emerald-400' : 'hover:border-orange-400';
                                    
                                    return (
                                      <div
                                        key={courier.id}
                                        className={cn(
                                          "flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 transition-all",
                                          hoverBorder
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                                            bgColor,
                                            textColor
                                          )}>
                                            {courier.name.charAt(0)}
                                          </div>
                                          <div>
                                            <p className="font-bold text-sm text-gray-900">{courier.name}</p>
                                            <p className="text-xs text-gray-500">{courier.vehicle_type}</p>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleUnassignCourier(courier.id, courier.name)}
                                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          title="Lepas dari shift"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Shift' : 'Tambah Shift'}</h2>
              <p className="text-gray-500 text-sm mt-1">Konfigurasi jadwal operasional baru.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Nama Kelompok</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Shift Malam"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-cyan focus:border-transparent outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-cyan outline-none transition-all font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-cyan outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                    formData.is_overnight ? "bg-indigo-500 text-white" : "bg-white text-gray-400 group-hover:text-indigo-400"
                  )}>
                    <Moon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">Melintas Malam?</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Shift Melewati Pukul 00:00</p>
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.is_overnight}
                    onChange={(e) => setFormData({ ...formData, is_overnight: e.target.checked })}
                  />
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    formData.is_overnight ? "bg-brand-cyan border-brand-cyan" : "border-gray-200"
                  )}>
                    {formData.is_overnight && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                    formData.is_active ? "bg-emerald-500 text-white" : "bg-white text-gray-400 group-hover:text-emerald-400"
                  )}>
                    <Power className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">Status Aktif</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Gunakan untuk operasional</p>
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    formData.is_active ? "bg-emerald-500 border-emerald-500" : "border-gray-200"
                  )}>
                    {formData.is_active && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] px-6 py-4 bg-brand-cyan text-white rounded-2xl font-bold shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    editingId ? 'Simpan Perubahan' : 'Buat Shift'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Couriers Modal */}
      {isAssignModalOpen && selectedShiftForAssign && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Assign Kurir ke {shifts.find(s => s.id === selectedShiftForAssign)?.name}</h2>
              <p className="text-gray-500 text-sm mt-1">Pilih kurir yang belum memiliki shift</p>
            </div>
            
            <div className="p-8 space-y-4 overflow-y-auto flex-1">
              {getUnassignedCouriers().length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Semua kurir sudah memiliki shift</p>
                  <p className="text-sm mt-1">Lepas kurir dari shift lain terlebih dahulu</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getUnassignedCouriers().map(courier => (
                    <label
                      key={courier.id}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                        selectedCouriersToAssign.includes(courier.id)
                          ? "bg-teal-50 border-teal-500"
                          : "bg-white border-gray-200 hover:border-teal-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCouriersToAssign.includes(courier.id)}
                        onChange={() => toggleCourierSelection(courier.id)}
                        className="w-5 h-5 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold">
                          {courier.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900">{courier.name}</p>
                          <p className="text-xs text-gray-500">{courier.vehicle_type} • {courier.phone}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-teal-600">{selectedCouriersToAssign.length}</span> kurir dipilih
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={handleAssignCouriers}
                  disabled={selectedCouriersToAssign.length === 0}
                  className="flex-[2] px-6 py-4 bg-brand-cyan text-white rounded-2xl font-bold shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign {selectedCouriersToAssign.length > 0 && `(${selectedCouriersToAssign.length})`} Kurir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Swap List Modal */}
      {isSwapListModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsSwapListModalOpen(false)} />
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-red-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <RefreshCw className="h-6 w-6 text-orange-500" />
                    Daftar Tukar Shift
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">Kelola jadwal tukar shift kurir</p>
                </div>
                <button
                  onClick={handleOpenSwapModal}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Tukar Shift
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              {isLoadingSwaps ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : shiftSwaps.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Belum ada tukar shift yang dijadwalkan</p>
                  <p className="text-sm mt-1">Klik "Tambah Tukar Shift" untuk membuat jadwal baru</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shiftSwaps.map((swap, index) => (
                    <div
                      key={`${swap.date}-${swap.courier1.id}-${swap.courier2.id}`}
                      className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border-2 border-orange-200 hover:border-orange-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="px-3 py-1 bg-orange-500 text-white rounded-lg font-bold text-sm">
                              {new Date(swap.date).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-200">
                              <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold">
                                {swap.courier1.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm text-gray-900">{swap.courier1.name}</p>
                                <p className="text-xs text-gray-500">→ {swap.courier2.shift_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-200">
                              <div className="w-10 h-10 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-bold">
                                {swap.courier2.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm text-gray-900">{swap.courier2.name}</p>
                                <p className="text-xs text-gray-500">→ {swap.courier1.shift_name}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSwap(swap.date, swap.courier1.id, swap.courier2.id)}
                          className="ml-4 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Hapus tukar shift"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setIsSwapListModalOpen(false)}
                className="w-full px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Swap Form Modal */}
      {isSwapModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsSwapModalOpen(false)} />
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-red-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="h-6 w-6 text-orange-500" />
                Tukar Shift
              </h2>
              <p className="text-gray-500 text-sm mt-1">Atur jadwal tukar shift antar kurir</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">📅 Tanggal Tukar Shift</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={swapFormData.date}
                  onChange={(e) => setSwapFormData({ ...swapFormData, date: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">👤 Kurir 1</label>
                <select
                  required
                  value={swapFormData.courier1_id}
                  onChange={(e) => setSwapFormData({ ...swapFormData, courier1_id: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium"
                >
                  <option value="">Pilih kurir...</option>
                  {couriers.filter(c => c.shift_id).map(courier => {
                    const shift = shifts.find(s => s.id === courier.shift_id);
                    return (
                      <option key={courier.id} value={courier.id}>
                        {courier.name} - {shift?.name || 'No Shift'}
                      </option>
                    );
                  })}
                </select>
                {swapFormData.courier1_id && (() => {
                  const courier = couriers.find(c => c.id === swapFormData.courier1_id);
                  const shift = shifts.find(s => s.id === courier?.shift_id);
                  return shift ? (
                    <p className="text-xs text-gray-500 pl-1">
                      ℹ️ Shift: {shift.name} ({shift.start_time.substring(0, 5)}-{shift.end_time.substring(0, 5)})
                    </p>
                  ) : null;
                })()}
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="p-3 bg-orange-100 rounded-full">
                  <RefreshCw className="h-6 w-6 text-orange-600" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">👤 Kurir 2</label>
                <select
                  required
                  value={swapFormData.courier2_id}
                  onChange={(e) => setSwapFormData({ ...swapFormData, courier2_id: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium"
                >
                  <option value="">Pilih kurir...</option>
                  {couriers.filter(c => c.shift_id && c.id !== swapFormData.courier1_id).map(courier => {
                    const shift = shifts.find(s => s.id === courier.shift_id);
                    return (
                      <option key={courier.id} value={courier.id}>
                        {courier.name} - {shift?.name || 'No Shift'}
                      </option>
                    );
                  })}
                </select>
                {swapFormData.courier2_id && (() => {
                  const courier = couriers.find(c => c.id === swapFormData.courier2_id);
                  const shift = shifts.find(s => s.id === courier?.shift_id);
                  return shift ? (
                    <p className="text-xs text-gray-500 pl-1">
                      ℹ️ Shift: {shift.name} ({shift.start_time.substring(0, 5)}-{shift.end_time.substring(0, 5)})
                    </p>
                  ) : null;
                })()}
                <p className="text-xs text-orange-600 pl-1 font-medium">
                  ⚠️ Harus dari shift yang berbeda
                </p>
              </div>

              {getSwapPreview() && (
                <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">📝 Preview:</p>
                  <p className="text-sm font-bold text-gray-900 mb-2">{getSwapPreview()!.text}</p>
                  {getSwapPreview()!.details.map((detail, i) => (
                    <p key={i} className="text-xs text-gray-600">{detail}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveSwap}
                  disabled={!swapFormData.date || !swapFormData.courier1_id || !swapFormData.courier2_id}
                  className="flex-[2] px-6 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Simpan Tukar Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
