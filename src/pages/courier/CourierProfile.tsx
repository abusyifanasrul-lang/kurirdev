import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { requestFCMPermission } from '@/lib/fcm';
import { usePermissions } from '@/hooks/usePermissions';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Mail,
  Phone,
  Lock,
  LogOut,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Bell,
  User as UserIcon,
  Hash,
  MapPin,
  Camera as CameraIcon,
  Settings as SettingsIcon,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  XCircle
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { supabase } from '@/lib/supabaseClient';
import { CourierBadge } from '@/components/couriers/CourierBadge';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatter';

type Tab = 'profile' | 'attendance';
type DateFilter = 'current_month' | 'previous_month' | 'custom';

interface ShiftAttendance {
  id: string;
  courier_id: string;
  shift_id: string;
  date: string;
  first_online_at: string | null;
  last_online_at: string | null;
  late_minutes: number;
  status: 'on_time' | 'late_minor' | 'late_major' | 'alpha' | 'excused';
  fine_type: 'per_order' | 'flat_major' | 'flat_alpha' | null;
  fine_per_order: number | null;
  flat_fine: number | null;
  flat_fine_status: 'active' | 'cancelled';
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  shift?: {
    name: string;
    start_time: string;
  }[] | null;
}

const statusConfig = {
  on_time: {
    label: 'Tepat Waktu',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  late: {
    label: 'Terlambat',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  late_minor: {
    label: 'Terlambat Ringan',
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  late_major: {
    label: 'Terlambat Berat',
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200'
  },
  alpha: {
    label: 'Alpha',
    icon: XCircle,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200'
  },
  excused: {
    label: 'Dimaafkan',
    icon: CheckCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  }
};

export function CourierProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { couriers } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();
  const { permissions, checkPermissions, requestNotification, requestBackgroundLocation, requestCamera, openSettings } = usePermissions();

  // Tab state - check location state for initial tab
  const [activeTab, setActiveTab] = useState<Tab>((location.state as any)?.activeTab || 'profile');

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendance[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('current_month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Real-time suspended check from useUserStore
  const liveUser = users.find((u: any) => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  const courierData = useMemo(() =>
    couriers.find(c => c.id === user?.id),
    [couriers, user?.id]
  );

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'default'
  );

  useEffect(() => {
    const checkPermission = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await PushNotifications.checkPermissions();
          setNotifPermission(perm.receive === 'granted' ? 'granted' : 'default');
        } catch (e) {
          console.warn('Failed to check push permissions:', e);
        }
      } else if (typeof Notification !== 'undefined') {
        setNotifPermission(Notification.permission);
      }
    };
    checkPermission();
  }, []);

  const handleRequestNotifPermission = async () => {
    if (!user) return;
    try {
      const token = await requestFCMPermission(user.id);
      if (token) {
        setNotifPermission('granted');
      } else {
        // Refresh local status from system if possible
        if (Capacitor.isNativePlatform()) {
          const perm = await PushNotifications.checkPermissions();
          setNotifPermission(perm.receive === 'granted' ? 'granted' : 'default');
        }
      }
    } catch (err) {
      console.error('Failed to request notification permission:', err);
    }
  };

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Password tidak cocok' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password minimal 8 karakter' });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    });

    if (error) {
      setMessage({ type: 'error', text: `Gagal memperbarui password: ${error.message}` });
    } else {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setIsChangePasswordOpen(false);
      setMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
    }

    setIsLoading(false);
    setTimeout(() => setMessage(null), 5000);
  };

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    
    switch (dateFilter) {
      case 'current_month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
      case 'previous_month':
        const prevMonth = subMonths(now, 1);
        return {
          from: startOfMonth(prevMonth),
          to: endOfMonth(prevMonth)
        };
      case 'custom':
        if (customDateFrom && customDateTo) {
          return {
            from: parseISO(customDateFrom),
            to: parseISO(customDateTo)
          };
        }
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
      default:
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
    }
  }, [dateFilter, customDateFrom, customDateTo]);

  // Fetch attendance records
  const fetchAttendance = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingAttendance(true);
    try {
      const { data, error } = await supabase
        .from('shift_attendance')
        .select(`
          *,
          shift:shifts(name, start_time)
        `)
        .eq('courier_id', user.id)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      const mappedData = (data || []).map((record: any) => ({
        ...record,
        shift: Array.isArray(record.shift) ? record.shift : (record.shift ? [record.shift] : null)
      })) as unknown as ShiftAttendance[];

      setAttendanceRecords(mappedData);
    } catch (err) {
      console.error('Failed to fetch attendance records:', err);
    } finally {
      setIsLoadingAttendance(false);
    }
  }, [user?.id, dateRange]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab, fetchAttendance]);

  // Calculate total fines for the period
  const totalFines = useMemo(() => {
    return attendanceRecords.reduce((sum, record) => {
      if (record.flat_fine_status === 'cancelled') return sum;
      
      let fineAmount = 0;
      if (record.fine_type === 'flat_major' || record.fine_type === 'flat_alpha') {
        fineAmount = record.flat_fine || 0;
      }
      
      return sum + fineAmount;
    }, 0);
  }, [attendanceRecords]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    return format(parseISO(timestamp), 'HH:mm', { locale: localeId });
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd MMM yyyy', { locale: localeId });
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
        <div className="flex bg-gray-100/80 backdrop-blur-sm rounded-xl p-1 gap-1">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95",
              activeTab === 'profile' 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-1 ring-emerald-500/20" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <UserIcon className={cn("w-4 h-4", activeTab === 'profile' ? "text-white" : "text-gray-300")} />
            <span>Profil</span>
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={cn(
              "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95",
              activeTab === 'attendance' 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-1 ring-emerald-500/20" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Calendar className={cn("w-4 h-4", activeTab === 'attendance' ? "text-white" : "text-gray-300")} />
            <span>Kehadiran</span>
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-emerald-600">
              {user?.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Kurir'}</h2>
            <p className="text-sm text-gray-500">Kurir</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`w-2 h-2 rounded-full ${isSuspended ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className={`text-xs ${isSuspended ? 'text-red-600' : 'text-emerald-600'}`}>
                {isSuspended ? 'Disuspend' : 'Aktif'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <UserIcon className="h-5 w-5 text-emerald-600" />
            </div>
              <div>
                <p className="text-[10px] uppercase tracking-mobile font-bold text-emerald-600">Nama Lengkap</p>
                <p className="text-sm font-medium text-gray-900">{user?.name || '-'}</p>
              </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Mail className="h-5 w-5 text-emerald-600" />
            </div>
              <div>
                <p className="text-[10px] uppercase tracking-mobile font-bold text-emerald-600">Email</p>
                <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
              </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Phone className="h-5 w-5 text-emerald-600" />
            </div>
              <div>
                <p className="text-[10px] uppercase tracking-mobile font-bold text-emerald-600">Nomor HP</p>
                <p className="text-sm font-medium text-gray-900">{user?.phone || '-'}</p>
              </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <CourierBadge type={courierData?.vehicle_type} showLabel={false} className="border-none bg-transparent p-0" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-mobile font-bold text-gray-400">Tipe Kendaraan</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-gray-900 capitalize">{courierData?.vehicle_type || 'Belum Diatur'}</p>
                <CourierBadge type={courierData?.vehicle_type} showLabel={false} />
              </div>
            </div>
          </div>

          {courierData?.plate_number && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <Hash className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-mobile font-bold text-gray-400">Plat Nomor</p>
                <p className="text-sm font-medium text-gray-900">{courierData.plate_number}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Sections */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {/* Ganti Password */}
        <div className="flex flex-col">
          <button
            onClick={() => !isSuspended && setIsChangePasswordOpen(!isChangePasswordOpen)}
            disabled={isSuspended}
            className={cn(
              "w-full flex items-center justify-between p-4 transition-colors",
              isSuspended ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Lock className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Ganti Password</p>
                <p className="text-sm text-gray-500">
                  {isSuspended ? "Akun sedang disuspend" : "Perbarui password akun kamu"}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              "h-5 w-4 text-gray-400 transition-transform",
              isChangePasswordOpen && "rotate-90"
            )} />
          </button>

          {isSuspended && (
            <div className="p-4 bg-red-50 border border-red-200 text-center">
              <p className="text-red-600 font-medium">
                Akun Anda sedang disuspend.
              </p>
              <p className="text-red-400 text-sm mt-1">
                Hubungi admin untuk informasi lebih lanjut.
              </p>
            </div>
          )}

          {isChangePasswordOpen && !isSuspended && (
            <div className="p-4 bg-gray-50/50 space-y-4">
              <div>
                <label 
                  htmlFor="new-password"
                  className="block text-[10px] font-bold text-gray-400 uppercase tracking-mobile mb-1"
                >
                  Password Baru
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                    if (message?.text === 'Password minimal 8 karakter') setMessage(null);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all",
                    message?.text === 'Password minimal 8 karakter'
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:ring-emerald-500"
                  )}
                  placeholder="Masukkan password baru"
                />
                <p className="text-[10px] text-gray-400 mt-1">Minimal 8 karakter</p>
                {message?.text === 'Password minimal 8 karakter' && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>
              <div>
                <label 
                  htmlFor="confirm-password"
                  className="block text-[10px] font-bold text-gray-400 uppercase tracking-mobile mb-1"
                >
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                    if (message?.text === 'Password tidak cocok') setMessage(null);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all",
                    message?.text === 'Password tidak cocok'
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:ring-emerald-500"
                  )}
                  placeholder="Konfirmasi password baru"
                />
                {message?.text === 'Password tidak cocok' && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={isLoading || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className={cn(
                  "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95",
                  isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-emerald-700"
                )}
              >
                {isLoading ? 'Memperbarui...' : 'Simpan Password Baru'}
              </button>

              {message?.type === 'success' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifikasi Push — Status */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                notifPermission === 'granted' ? 'bg-emerald-50' :
                notifPermission === 'denied' ? 'bg-red-50' : 'bg-yellow-50'
              }`}>
                <Bell className={`h-5 w-5 ${
                  notifPermission === 'granted' ? 'text-emerald-600' :
                  notifPermission === 'denied' ? 'text-red-500' : 'text-yellow-500'
                }`} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Notifikasi Order</p>
                <p className={`text-sm font-semibold ${
                  notifPermission === 'granted' ? 'text-emerald-600' :
                  notifPermission === 'denied' ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {notifPermission === 'granted' ? '✅ Diizinkan' :
                   notifPermission === 'denied' ? '❌ Diblokir' : '⚠️ Belum diizinkan'}
                </p>
                {notifPermission === 'granted' && (
                  <button 
                    onClick={handleRequestNotifPermission}
                    className="text-[10px] font-bold text-emerald-600 uppercase tracking-mobile hover:underline mt-0.5"
                  >
                    Sinkronkan Sekarang
                  </button>
                )}
              </div>
            </div>
            {notifPermission === 'default' && (
              <button
                onClick={handleRequestNotifPermission}
                className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100"
              >
                Izinkan
              </button>
            )}
            {notifPermission === 'denied' && Capacitor.isNativePlatform() && (
              <button
                onClick={openSettings}
                className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 flex items-center gap-1"
              >
                <SettingsIcon className="h-3 w-3" />
                Buka
              </button>
            )}
          </div>

          {/* Warning jika diblokir */}
          {notifPermission === 'denied' && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-red-700">
                ⚠️ Notifikasi order diblokir!
              </p>
              <p className="text-xs text-red-600">
                Kamu tidak akan mendapat notifikasi saat ada order baru. {Capacitor.isNativePlatform() ? 'Ketuk tombol "Buka" untuk mengaktifkan di pengaturan.' : 'Aktifkan notifikasi dengan langkah berikut:'}
              </p>
              {!Capacitor.isNativePlatform() && (
                <div className="text-xs text-red-700 space-y-1 bg-white rounded-lg p-2 border border-red-100">
                  <p className="font-semibold mb-1">Di Chrome Android:</p>
                  <p>1. Ketuk ikon 🔒 di address bar browser</p>
                  <p>2. Ketuk "Izin situs"</p>
                  <p>3. Aktifkan <span className="font-semibold">Notifikasi</span></p>
                  <p className="font-semibold mt-2 mb-1">Atau via Pengaturan HP:</p>
                  <p>1. Buka <span className="font-semibold">Pengaturan</span> HP</p>
                  <p>2. Cari & ketuk <span className="font-semibold">Aplikasi → Chrome</span></p>
                  <p>3. Ketuk <span className="font-semibold">Notifikasi</span> → Aktifkan</p>
                </div>
              )}
            </div>
          )}

          {/* Info jika belum diputuskan */}
          {notifPermission === 'default' && (
            <div className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs text-yellow-700">
                Izinkan notifikasi agar kamu bisa menerima order baru secara real-time.
              </p>
            </div>
          )}
        </div>

        {/* Location Permission — Status (Native only) */}
        {Capacitor.isNativePlatform() && (
          <div className="flex flex-col">
            <button
              onClick={async () => {
                if (permissions.location === 'prompt') {
                  await requestBackgroundLocation();
                  await checkPermissions();
                } else {
                  // Always open settings for granted/denied to allow re-check or manage
                  await openSettings();
                }
              }}
              className="w-full flex items-center justify-between p-4 transition-colors text-left hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  permissions.location === 'granted' ? 'bg-emerald-50' :
                  permissions.location === 'denied' ? 'bg-red-50' : 'bg-yellow-50'
                }`}>
                  <MapPin className={`h-5 w-5 ${
                    permissions.location === 'granted' ? 'text-emerald-600' :
                    permissions.location === 'denied' ? 'text-red-500' : 'text-yellow-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Akses Lokasi</p>
                  <p className={`text-sm font-semibold ${
                    permissions.location === 'granted' ? 'text-emerald-600' :
                    permissions.location === 'denied' ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {permissions.location === 'granted' ? '✅ Diizinkan' :
                     permissions.location === 'denied' ? '❌ Diblokir' : '⚠️ Belum diizinkan'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {permissions.location === 'granted' ? 'Ketuk untuk buka pengaturan' : 'Ketuk untuk mengaktifkan'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                <SettingsIcon className="h-3 w-3" />
                {permissions.location === 'prompt' ? 'Izinkan' : 'Buka'}
              </div>
            </button>

            {permissions.location === 'denied' && (
              <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  ⚠️ Akses lokasi diblokir!
                </p>
                <p className="text-xs text-red-600">
                  Fitur STAY monitoring tidak akan berfungsi. Ketuk item di atas untuk membuka pengaturan.
                </p>
              </div>
            )}

            {permissions.location === 'prompt' && (
              <div className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-yellow-700">
                  Ketuk item di atas untuk mengaktifkan akses lokasi. Pastikan pilih <span className="font-bold">"Izinkan sepanjang waktu"</span> agar STAY monitoring berfungsi.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Camera Permission — Status (Native only) */}
        {Capacitor.isNativePlatform() && (
          <div className="flex flex-col">
            <button
              onClick={async () => {
                if (permissions.camera === 'prompt') {
                  await requestCamera();
                  await checkPermissions();
                } else if (permissions.camera === 'denied') {
                  await openSettings();
                }
              }}
              disabled={permissions.camera === 'granted'}
              className={cn(
                "w-full flex items-center justify-between p-4 transition-colors text-left",
                permissions.camera === 'granted' ? "cursor-default" : "hover:bg-gray-50 active:bg-gray-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  permissions.camera === 'granted' ? 'bg-emerald-50' :
                  permissions.camera === 'denied' ? 'bg-red-50' : 'bg-yellow-50'
                }`}>
                  <CameraIcon className={`h-5 w-5 ${
                    permissions.camera === 'granted' ? 'text-emerald-600' :
                    permissions.camera === 'denied' ? 'text-red-500' : 'text-yellow-500'
                  }`} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Akses Kamera</p>
                  <p className={`text-sm font-semibold ${
                    permissions.camera === 'granted' ? 'text-emerald-600' :
                    permissions.camera === 'denied' ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {permissions.camera === 'granted' ? '✅ Diizinkan' :
                     permissions.camera === 'denied' ? '❌ Diblokir' : '⚠️ Belum diizinkan'}
                  </p>
                  {permissions.camera === 'prompt' && (
                    <p className="text-xs text-gray-500 mt-0.5">Ketuk untuk mengaktifkan</p>
                  )}
                </div>
              </div>
              {permissions.camera === 'denied' && (
                <div className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
                  <SettingsIcon className="h-3 w-3" />
                  Buka
                </div>
              )}
              {permissions.camera === 'prompt' && (
                <div className="flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full">
                  Izinkan
                </div>
              )}
            </button>

            {permissions.camera === 'denied' && (
              <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  ⚠️ Akses kamera diblokir!
                </p>
                <p className="text-xs text-red-600">
                  Tidak bisa scan QR code untuk aktivasi STAY. Ketuk item di atas untuk membuka pengaturan.
                </p>
              </div>
            )}

            {permissions.camera === 'prompt' && (
              <div className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-yellow-700">
                  Ketuk item di atas untuk mengaktifkan akses kamera agar bisa scan QR code.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Refresh Permissions Button */}
        {Capacitor.isNativePlatform() && (
          <div className="p-4">
            <button
              onClick={checkPermissions}
              className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95 text-sm"
            >
              🔄 Refresh Status Izin
            </button>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all active:scale-95 border border-red-100"
      >
        <LogOut className="h-5 w-5" />
        Keluar
      </button>

      {/* App Version */}
      <p className="text-center text-[10px] uppercase tracking-widest text-gray-400 font-bold">
        Kurir System v1.1.0
      </p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Date Filter */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 mb-4">
            <div className="flex bg-gray-100/80 backdrop-blur-sm rounded-xl p-1 gap-1">
              <button 
                onClick={() => setDateFilter('current_month')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                  dateFilter === 'current_month'
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                Bulan Ini
              </button>
              <button 
                onClick={() => setDateFilter('previous_month')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                  dateFilter === 'previous_month'
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                Bulan Lalu
              </button>
              <button 
                onClick={() => setDateFilter('custom')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                  dateFilter === 'custom'
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Range Inputs */}
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
                    Dari
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
                    Sampai
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 shadow-lg text-white mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                Periode: {format(dateRange.from, 'dd MMM', { locale: localeId })} - {format(dateRange.to, 'dd MMM yyyy', { locale: localeId })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-75 mb-1">
                  Total Kehadiran
                </p>
                <p className="text-2xl font-black">
                  {attendanceRecords.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-75 mb-1">
                  Total Denda
                </p>
                <p className="text-2xl font-black">
                  {formatCurrency(totalFines)}
                </p>
              </div>
            </div>
          </div>

          {/* Attendance Records */}
          <div className="space-y-3">
            {isLoadingAttendance ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </>
            ) : attendanceRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
                  <Calendar className="h-10 w-10 text-gray-200" />
                </div>
                <p className="text-sm font-black text-gray-400 uppercase tracking-tight">TIDAK ADA DATA</p>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">Belum ada riwayat kehadiran untuk periode ini</p>
              </div>
            ) : (
              attendanceRecords.map((record) => {
                const config = statusConfig[record.status as keyof typeof statusConfig] || {
                  label: record.status || 'Unknown',
                  icon: Clock,
                  color: 'text-gray-600',
                  bg: 'bg-gray-50',
                  border: 'border-gray-200'
                };
                const isExpanded = expandedRows.has(record.id);
                const hasFine = record.fine_type !== null && record.flat_fine_status !== 'cancelled';
                const fineAmount = (record.fine_type === 'flat_major' || record.fine_type === 'flat_alpha') 
                  ? (record.flat_fine || 0)
                  : 0;

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    {/* Main Row */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900 mb-1">
                            {formatDate(record.date)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[9px] font-bold bg-gray-100 text-gray-600">
                              {(record.shift && Array.isArray(record.shift) && record.shift[0]?.name) || 'Shift'}
                            </Badge>
                            <div className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                              config.bg,
                              config.color,
                              config.border
                            )}>
                              {config.label}
                            </div>
                          </div>
                        </div>
                        {hasFine && (
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-0.5">
                              Denda
                            </p>
                            <p className="text-sm font-black text-red-600">
                              {record.fine_type === 'per_order' 
                                ? `Rp ${(record.fine_per_order || 0).toLocaleString('id-ID')}/order`
                                : formatCurrency(fineAmount)
                              }
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Time Info */}
                      <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            Check-In
                          </p>
                          <p className="text-xs font-bold text-gray-900">
                            {formatTime(record.first_online_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            Check-Out
                          </p>
                          <p className="text-xs font-bold text-gray-900">
                            {formatTime(record.last_online_at)}
                          </p>
                        </div>
                      </div>

                      {/* Expand Button */}
                      {(hasFine || record.notes || record.late_minutes > 0) && (
                        <button
                          onClick={() => toggleRow(record.id)}
                          className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 rounded-xl transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Sembunyikan Detail
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Lihat Detail
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Late Minutes */}
                        {record.late_minutes > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mb-1">
                              Keterlambatan
                            </p>
                            <p className="text-sm font-bold text-orange-900">
                              {record.late_minutes} menit
                            </p>
                          </div>
                        )}

                        {/* Fine Details */}
                        {hasFine && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                            <div>
                              <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                                Jenis Denda
                              </p>
                              <p className="text-xs font-bold text-red-900">
                                {record.fine_type === 'per_order' && 'Per Order'}
                                {record.fine_type === 'flat_major' && 'Flat Major'}
                                {record.fine_type === 'flat_alpha' && 'Flat Alpha'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                                Jumlah
                              </p>
                              <p className="text-sm font-black text-red-900">
                                {record.fine_type === 'per_order' 
                                  ? `Rp ${(record.fine_per_order || 0).toLocaleString('id-ID')} per order`
                                  : formatCurrency(fineAmount)
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                                Status Pembayaran
                              </p>
                              <Badge 
                                variant={record.flat_fine_status === 'active' ? 'warning' : 'success'}
                                className="text-[9px] font-bold"
                              >
                                {record.flat_fine_status === 'active' ? 'Belum Dibayar' : 'Dibatalkan'}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Admin Notes */}
                        {record.notes && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-2">
                              Catatan Admin
                            </p>
                            <p className="text-xs text-blue-900 leading-relaxed">
                              {record.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
