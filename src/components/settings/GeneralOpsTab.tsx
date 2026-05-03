import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Settings, MapPin, Clock, Plus, Edit3, Trash2, Calendar } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useToastStore } from '@/stores/useToastStore';

interface Basecamp {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  is_national: boolean;
  is_active: boolean;
}

interface GeneralOpsTabProps {
  operational_area: string;
  operational_timezone: string;
  billing_start_day: number;
  onSaveSettings: (data: { operational_area: string, operational_timezone: string, billing_start_day: number }) => void;
}

export function GeneralOpsTab({
  operational_area,
  operational_timezone,
  billing_start_day,
  onSaveSettings,
}: GeneralOpsTabProps) {
  const [form, setForm] = useState({
    operational_area,
    operational_timezone: operational_timezone || 'Asia/Jakarta',
    billing_start_day: billing_start_day || 1,
  });

  // Basecamp state
  const { basecamps, fetchBasecamps, addBasecamp, updateBasecamp, deleteBasecamp, holidays, fetchHolidays, addHoliday, updateHoliday, deleteHoliday } = useSettingsStore();
  const { addToast } = useToastStore();
  const [isBasecampModalOpen, setIsBasecampModalOpen] = useState(false);
  const [editingBasecamp, setEditingBasecamp] = useState<Basecamp | null>(null);
  const [isSavingBasecamp, setIsSavingBasecamp] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [basecampToDelete, setBasecampToDelete] = useState<string | null>(null);
  const [basecampForm, setBasecampForm] = useState({
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    radius_m: 10,
    is_active: true,
  });

  // Holiday state
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [isDeleteHolidayModalOpen, setIsDeleteHolidayModalOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<string | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    name: '',
    is_national: true,
    is_active: true,
  });

  useEffect(() => {
    fetchBasecamps();
    fetchHolidays();
  }, [fetchBasecamps, fetchHolidays]);

  const handleSave = () => {
    onSaveSettings(form);
  };

  const openBasecampModal = (basecamp?: Basecamp) => {
    if (basecamp) {
      setEditingBasecamp(basecamp);
      setBasecampForm({
        name: basecamp.name,
        address: basecamp.address,
        lat: basecamp.lat,
        lng: basecamp.lng,
        radius_m: basecamp.radius_m,
        is_active: basecamp.is_active,
      });
    } else {
      setEditingBasecamp(null);
      setBasecampForm({
        name: '',
        address: '',
        lat: 0,
        lng: 0,
        radius_m: 10,
        is_active: true,
      });
    }
    setIsBasecampModalOpen(true);
  };

  const handleSaveBasecamp = async () => {
    // Validasi form
    if (!basecampForm.name.trim()) {
      addToast('Nama basecamp harus diisi', 'warning');
      return;
    }
    if (!basecampForm.address.trim()) {
      addToast('Alamat harus diisi', 'warning');
      return;
    }
    if (basecampForm.lat === 0 || basecampForm.lng === 0) {
      addToast('Koordinat latitude dan longitude harus diisi dengan benar', 'warning');
      return;
    }

    setIsSavingBasecamp(true);
    const loadingToastId = addToast('Menyimpan basecamp...', 'loading');
    
    try {
      console.log('Saving basecamp:', basecampForm);
      
      if (editingBasecamp) {
        await updateBasecamp(editingBasecamp.id, basecampForm);
        console.log('Basecamp updated successfully');
        useToastStore.getState().removeToast(loadingToastId);
        addToast('Basecamp berhasil diupdate!', 'success');
      } else {
        await addBasecamp(basecampForm);
        console.log('Basecamp added successfully');
        useToastStore.getState().removeToast(loadingToastId);
        addToast('Basecamp berhasil ditambahkan!', 'success');
      }
      
      // Refresh list
      await fetchBasecamps();
      
      // Close modal and reset form
      setIsBasecampModalOpen(false);
      setEditingBasecamp(null);
      setBasecampForm({
        name: '',
        address: '',
        lat: 0,
        lng: 0,
        radius_m: 10,
        is_active: true,
      });
    } catch (error) {
      console.error('Error saving basecamp:', error);
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        `Gagal menyimpan basecamp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        5000
      );
    } finally {
      setIsSavingBasecamp(false);
    }
  };

  const handleDeleteBasecamp = async (id: string) => {
    setBasecampToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteBasecamp = async () => {
    if (!basecampToDelete) return;
    
    const loadingToastId = addToast('Menghapus basecamp...', 'loading');
    
    try {
      await deleteBasecamp(basecampToDelete);
      useToastStore.getState().removeToast(loadingToastId);
      addToast('Basecamp berhasil dihapus!', 'success');
      setIsDeleteModalOpen(false);
      setBasecampToDelete(null);
    } catch (error) {
      console.error('Error deleting basecamp:', error);
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        `Gagal menghapus basecamp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        5000
      );
    }
  };

  // Holiday handlers
  const openHolidayModal = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        date: holiday.date,
        name: holiday.name,
        is_national: holiday.is_national,
        is_active: holiday.is_active,
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        date: '',
        name: '',
        is_national: true,
        is_active: true,
      });
    }
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = async () => {
    // Validasi form
    if (!holidayForm.date) {
      addToast('Tanggal harus diisi', 'warning');
      return;
    }
    if (!holidayForm.name.trim()) {
      addToast('Nama hari libur harus diisi', 'warning');
      return;
    }

    setIsSavingHoliday(true);
    const loadingToastId = addToast('Menyimpan hari libur...', 'loading');
    
    try {
      console.log('Saving holiday:', holidayForm);
      
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, holidayForm);
        console.log('Holiday updated successfully');
        useToastStore.getState().removeToast(loadingToastId);
        addToast('Hari libur berhasil diupdate!', 'success');
      } else {
        await addHoliday(holidayForm);
        console.log('Holiday added successfully');
        useToastStore.getState().removeToast(loadingToastId);
        addToast('Hari libur berhasil ditambahkan!', 'success');
      }
      
      // Refresh list
      await fetchHolidays();
      
      // Close modal and reset form
      setIsHolidayModalOpen(false);
      setEditingHoliday(null);
      setHolidayForm({
        date: '',
        name: '',
        is_national: true,
        is_active: true,
      });
    } catch (error) {
      console.error('Error saving holiday:', error);
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        `Gagal menyimpan hari libur: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        5000
      );
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    setHolidayToDelete(id);
    setIsDeleteHolidayModalOpen(true);
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    
    const loadingToastId = addToast('Menghapus hari libur...', 'loading');
    
    try {
      await deleteHoliday(holidayToDelete);
      useToastStore.getState().removeToast(loadingToastId);
      addToast('Hari libur berhasil dihapus!', 'success');
      setIsDeleteHolidayModalOpen(false);
      setHolidayToDelete(null);
    } catch (error) {
      console.error('Error deleting holiday:', error);
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        `Gagal menghapus hari libur: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        5000
      );
    }
  };

  const toggleHolidayActive = async (holiday: Holiday) => {
    const loadingToastId = addToast(
      holiday.is_active ? 'Menonaktifkan hari libur...' : 'Mengaktifkan hari libur...',
      'loading'
    );
    
    try {
      await updateHoliday(holiday.id, { is_active: !holiday.is_active });
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        holiday.is_active ? 'Hari libur dinonaktifkan!' : 'Hari libur diaktifkan!',
        'success'
      );
      await fetchHolidays();
    } catch (error) {
      console.error('Error toggling holiday:', error);
      useToastStore.getState().removeToast(loadingToastId);
      addToast(
        `Gagal mengubah status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        5000
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card>
        <div className="p-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-display">Pengaturan Umum</h3>
              <p className="text-sm text-gray-500">Konfigurasi operasional dasar sistem kurir.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Section 1: Navigasi & Lokasi */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <MapPin className="h-24 w-24" />
              </div>
              
              <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
                <div className="bg-emerald-100 p-1.5 rounded-lg">
                  <MapPin className="h-4 w-4" />
                </div>
                Navigasi & Lokasi
              </h4>
              
              <div className="space-y-4">
                <Input
                  label="Area Operasional Utama"
                  helperText="Kota atau wilayah default untuk pencarian alamat Google Maps."
                  type="text"
                  value={form.operational_area}
                  onChange={e => setForm({ ...form, operational_area: e.target.value })}
                  placeholder="Contoh: Sengkang, Wajo"
                  className="text-lg font-semibold bg-white"
                />
                
                <div className="bg-white/60 border border-emerald-100/50 p-3 rounded-xl">
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    <span className="font-bold underline">Contoh:</span> Jika kurir mencari "Jl. Mawar 34" dan area ini diset ke "Sengkang, Wajo", Google Maps akan otomatis mencari lokasi tersebut di wilayah Anda, bukan di kota lain yang memiliki nama jalan serupa.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Zona Waktu */}
            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Clock className="h-24 w-24 text-blue-600" />
              </div>

              <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg">
                  <Clock className="h-4 w-4" />
                </div>
                Waktu & Standar Laporan
              </h4>

              <div className="relative">
                <label className="block text-xs font-bold text-blue-900/60 uppercase tracking-widest mb-2 px-1">
                  Zona Waktu Operasional
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-100/50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <select
                    className="w-full pl-12 pr-10 py-3.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none text-gray-900 font-semibold shadow-sm"
                    value={form.operational_timezone}
                    onChange={(e) => setForm({ ...form, operational_timezone: e.target.value })}
                  >
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none border-l border-blue-100 pl-3">
                    <Settings className="h-4 w-4 text-blue-300" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2 px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Sistem akan menggunakan zona waktu ini sebagai standar pergantian hari (00:00) pada seluruh Laporan Keuangan, Statistik Dashboard, dan Analitik.
                  </p>
                </div>
              </div>
            </div>
            </div>

            {/* Section 3: Siklus Penagihan */}
            <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl relative overflow-hidden group mt-6">
              <h4 className="text-sm font-bold text-amber-800 mb-4 flex items-center gap-2">
                <div className="bg-amber-100 p-1.5 rounded-lg">
                  <Settings className="h-4 w-4" />
                </div>
                Siklus Penagihan
              </h4>

              <div className="relative">
                <label className="block text-xs font-bold text-amber-900/60 uppercase tracking-widest mb-2 px-1">
                  Hari Awal Mingguan
                </label>
                <select
                  className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all appearance-none text-gray-900 font-semibold shadow-sm"
                  value={form.billing_start_day}
                  onChange={(e) => setForm({ ...form, billing_start_day: Number(e.target.value) })}
                >
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                  <option value={0}>Minggu</option>
                </select>
                <p className="mt-2 text-[11px] text-amber-700 leading-relaxed">
                  Menentukan hari pertama dalam satu minggu untuk filter laporan "Minggu Ini" dan perhitungan insentif mingguan kurir.
                </p>
              </div>
            </div>

            {/* Section 4: Basecamp Management */}
            <div className="bg-purple-50/50 border border-purple-100 p-5 rounded-2xl relative overflow-hidden group mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                  <div className="bg-purple-100 p-1.5 rounded-lg">
                    <MapPin className="h-4 w-4" />
                  </div>
                  Manajemen Basecamp
                </h4>
                <Button
                  onClick={() => openBasecampModal()}
                  size="sm"
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Basecamp
                </Button>
              </div>

              {basecamps.length === 0 ? (
                <div className="text-center py-8 text-purple-600 bg-white/60 rounded-xl border border-purple-100">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-purple-300" />
                  <p className="font-semibold">Belum ada basecamp</p>
                  <p className="text-xs mt-1">Tambah basecamp untuk mengaktifkan fitur GPS STAY</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {basecamps.map((basecamp) => (
                    <div
                      key={basecamp.id}
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-purple-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          basecamp.is_active ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{basecamp.name}</p>
                            {!basecamp.is_active && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{basecamp.address}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            📍 {basecamp.lat.toFixed(6)}, {basecamp.lng.toFixed(6)} • Radius: {basecamp.radius_m}m
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBasecampModal(basecamp)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBasecamp(basecamp.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-purple-700 leading-relaxed px-1">
                Basecamp digunakan untuk fitur GPS STAY. Kurir harus berada dalam radius yang ditentukan untuk melakukan scan QR absensi.
              </p>
            </div>

            {/* Section 5: Holiday Management */}
            <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-2xl relative overflow-hidden group mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                  <div className="bg-orange-100 p-1.5 rounded-lg">
                    <Calendar className="h-4 w-4" />
                  </div>
                  Manajemen Hari Libur
                </h4>
                <Button
                  onClick={() => openHolidayModal()}
                  size="sm"
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4" />
                  Tetapkan Libur
                </Button>
              </div>

              {holidays.length === 0 ? (
                <div className="text-center py-8 text-orange-600 bg-white/60 rounded-xl border border-orange-100">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-orange-300" />
                  <p className="font-semibold">Belum ada hari libur</p>
                  <p className="text-xs mt-1">Tetapkan hari libur nasional atau cuti bersama</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidays.map((holiday) => {
                    const holidayDate = new Date(holiday.date);
                    const formattedDate = holidayDate.toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    
                    return (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-orange-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            holiday.is_active ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{holiday.name}</p>
                              {holiday.is_national && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                                  Nasional
                                </span>
                              )}
                              {!holiday.is_active && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{formattedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleHolidayActive(holiday)}
                            className={`${
                              holiday.is_active 
                                ? 'text-gray-600 hover:text-gray-700 hover:bg-gray-50' 
                                : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                            }`}
                            title={holiday.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {holiday.is_active ? '👁️' : '👁️‍🗨️'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHolidayModal(holiday)}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-[11px] text-orange-700 leading-relaxed px-1">
                Hari libur digunakan oleh sistem untuk skip perhitungan alpha. Kurir tidak akan kena denda alpha di hari libur yang aktif.
              </p>
            </div>
            
            <div className="pt-4">
              <Button onClick={handleSave} className="w-full lg:w-auto px-10 bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100">
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex gap-3 text-gray-600">
        <div className="bg-white p-1.5 rounded-lg border border-gray-200">
          <Settings className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-800">Tips Operasional</h4>
          <p className="text-xs mt-1 leading-relaxed">
            Gunakan format "Kota, Kabupaten" untuk akurasi terbaik pada perangkat Android dan iOS.
          </p>
        </div>
      </div>

      {/* Basecamp Modal */}
      <Modal
        isOpen={isBasecampModalOpen}
        onClose={() => setIsBasecampModalOpen(false)}
        title={editingBasecamp ? 'Edit Basecamp' : 'Tambah Basecamp'}
      >
        <div className="space-y-4">
          <Input
            label="Nama Basecamp"
            value={basecampForm.name}
            onChange={(e) => setBasecampForm({ ...basecampForm, name: e.target.value })}
            placeholder="Contoh: Basecamp Utama"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
              rows={3}
              value={basecampForm.address}
              onChange={(e) => setBasecampForm({ ...basecampForm, address: e.target.value })}
              placeholder="Alamat lengkap basecamp"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="0.000001"
              value={basecampForm.lat}
              onChange={(e) => setBasecampForm({ ...basecampForm, lat: parseFloat(e.target.value) || 0 })}
              placeholder="-4.123456"
            />
            <Input
              label="Longitude"
              type="number"
              step="0.000001"
              value={basecampForm.lng}
              onChange={(e) => setBasecampForm({ ...basecampForm, lng: parseFloat(e.target.value) || 0 })}
              placeholder="119.123456"
            />
          </div>
          <Input
            label="Radius (meter)"
            type="number"
            value={basecampForm.radius_m}
            onChange={(e) => setBasecampForm({ ...basecampForm, radius_m: parseInt(e.target.value) || 10 })}
            helperText="Jarak maksimal kurir dari titik basecamp untuk scan QR (default: 10 meter)"
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={basecampForm.is_active}
              onChange={(e) => setBasecampForm({ ...basecampForm, is_active: e.target.checked })}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Basecamp Aktif
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsBasecampModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveBasecamp}
              disabled={isSavingBasecamp}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingBasecamp ? 'Menyimpan...' : (editingBasecamp ? 'Simpan' : 'Tambah')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Basecamp"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <div className="shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">
                Yakin ingin menghapus basecamp ini?
              </p>
              <p className="text-xs text-red-700">
                Tindakan ini tidak dapat dibatalkan. Basecamp yang dihapus tidak akan bisa digunakan untuk fitur GPS STAY.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setBasecampToDelete(null);
              }}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={confirmDeleteBasecamp}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Hapus
            </Button>
          </div>
        </div>
      </Modal>

      {/* Holiday Modal */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHoliday ? 'Edit Hari Libur' : 'Tetapkan Hari Libur'}
      >
        <div className="space-y-4">
          <Input
            label="Nama Hari Libur"
            value={holidayForm.name}
            onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
            placeholder="Contoh: Idul Fitri, Hari Kemerdekaan"
          />
          <Input
            label="Tanggal"
            type="date"
            value={holidayForm.date}
            onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_national"
              checked={holidayForm.is_national}
              onChange={(e) => setHolidayForm({ ...holidayForm, is_national: e.target.checked })}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="is_national" className="text-sm font-medium text-gray-700">
              Libur Nasional
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active_holiday"
              checked={holidayForm.is_active}
              onChange={(e) => setHolidayForm({ ...holidayForm, is_active: e.target.checked })}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="is_active_holiday" className="text-sm font-medium text-gray-700">
              Hari Libur Aktif
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsHolidayModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveHoliday}
              disabled={isSavingHoliday}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingHoliday ? 'Menyimpan...' : (editingHoliday ? 'Simpan' : 'Tetapkan')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Holiday Confirmation Modal */}
      <Modal
        isOpen={isDeleteHolidayModalOpen}
        onClose={() => setIsDeleteHolidayModalOpen(false)}
        title="Hapus Hari Libur"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <div className="shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">
                Yakin ingin menghapus hari libur ini?
              </p>
              <p className="text-xs text-red-700">
                Tindakan ini tidak dapat dibatalkan. Hari libur yang dihapus tidak akan digunakan dalam perhitungan alpha.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteHolidayModalOpen(false);
                setHolidayToDelete(null);
              }}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={confirmDeleteHoliday}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
