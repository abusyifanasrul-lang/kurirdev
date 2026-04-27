import { useEffect, useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useShiftStore } from '@/stores/useShiftStore';
import { cn } from '@/utils/cn';

interface ShiftFormData {
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  is_active: boolean;
}

const initialFormData: ShiftFormData = {
  name: '',
  start_time: '08:00',
  end_time: '17:00',
  is_overnight: false,
  is_active: true,
};

export default function Shifts() {
  const { shifts, isLoading, fetchShifts, addShift, updateShift } = useShiftStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

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
        
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-cyan text-white rounded-2xl font-semibold shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90 transition-all active:scale-95 group"
        >
          <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
          Tambah Shift Baru
        </button>
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
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-8"><div className="h-12 bg-gray-100 rounded-2xl w-full"></div></td>
                  </tr>
                ))
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="h-12 w-12 text-gray-300" />
                      <p className="text-gray-500 font-medium">Belum ada data shift.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-brand-cyan/5 transition-colors group">
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
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleOpenModal(shift)}
                        className="p-3 text-gray-400 hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-2xl transition-all"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
