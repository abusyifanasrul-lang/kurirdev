import { useEffect, useState } from 'react';
import { Clock, Search, Filter, AlertCircle, CheckCircle2, UserMinus, AlertTriangle, Bell, X, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useAdminAttendanceStore } from '@/stores/useAdminAttendanceStore';
import { useShiftStore } from '@/stores/useShiftStore';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/formatter';
import { useAuth } from '@/context/AuthContext';

interface AdminAttendanceLog {
  id: string;
  courier_id: string;
  shift_id: string;
  first_online_at: string | null;
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

export function AttendanceMonitoring() {
  const { user } = useAuth();
  const { 
    logs, 
    missingCouriers, 
    isLoading, 
    fetchTodayLogs, 
    fetchMissingCouriers, 
    subscribeToday, 
    applyFine, 
    excuseLate 
  } = useAdminAttendanceStore();
  const { shifts, fetchShifts } = useShiftStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Fine dialog state
  const [showFineDialog, setShowFineDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminAttendanceLog | null>(null);
  const [fineNotes, setFineNotes] = useState('');

  useEffect(() => {
    fetchTodayLogs();
    fetchMissingCouriers();
    fetchShifts();

    // Refresh setiap 5 detik untuk update minutes_late secara realtime
    // Also refresh logs to catch new check-ins faster
    const interval = setInterval(() => {
      fetchMissingCouriers();
      fetchTodayLogs();
    }, 5_000);

    const unsubscribe = subscribeToday();

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []); // ✅ Empty deps - only run once on mount

  // Pisahkan berdasarkan tingkat urgensi dan filter shift:
  const filteredMissing = missingCouriers.filter(c => 
    selectedShift === 'all' || c.shift_id === selectedShift
  );
  
  const criticalMissing = filteredMissing.filter(c => c.minutes_late >= 60);
  const warningMissing = filteredMissing.filter(c => c.minutes_late >= 1 && c.minutes_late < 60);

  const handleApplyFine = async (log: AdminAttendanceLog, fineType: 'per_order' | 'flat_major') => {
    if (!user) return;
    setActionLoading(log.id);
    await applyFine(log.id, fineType, user.id, fineNotes || undefined);
    setActionLoading(null);
    setShowFineDialog(false);
    setFineNotes('');
    setSelectedLog(null);
  };

  const openFineDialog = (log: AdminAttendanceLog) => {
    setSelectedLog(log);
    setFineNotes('');
    setShowFineDialog(true);
  };

  const handleExcuse = async (log: AdminAttendanceLog) => {
    if (!user) return;
    setActionLoading(log.id);
    await excuseLate(log.id, user.id);
    setActionLoading(null);
  };

  const needsAdminAction = (log: AdminAttendanceLog) => 
    log.status === 'late' && log.fine_type === null;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.courier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShift = selectedShift === 'all' || log.shift_id === selectedShift;
    return matchesSearch && matchesShift;
  }).sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'courier_name':
        aVal = a.courier_name?.toLowerCase() || '';
        bVal = b.courier_name?.toLowerCase() || '';
        break;
      case 'shift_name':
        aVal = a.shift_name?.toLowerCase() || '';
        bVal = b.shift_name?.toLowerCase() || '';
        break;
      case 'first_online_at':
        aVal = a.first_online_at ? new Date(a.first_online_at).getTime() : 0;
        bVal = b.first_online_at ? new Date(b.first_online_at).getTime() : 0;
        break;
      case 'last_online_at':
        aVal = a.last_online_at ? new Date(a.last_online_at).getTime() : 0;
        bVal = b.last_online_at ? new Date(b.last_online_at).getTime() : 0;
        break;
      case 'duration':
        const aDuration = a.first_online_at && a.last_online_at
          ? Math.round((new Date(a.last_online_at).getTime() - new Date(a.first_online_at).getTime()) / (1000 * 60))
          : 0;
        const bDuration = b.first_online_at && b.last_online_at
          ? Math.round((new Date(b.last_online_at).getTime() - new Date(b.first_online_at).getTime()) / (1000 * 60))
          : 0;
        aVal = aDuration;
        bVal = bDuration;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'late_minutes':
        aVal = a.late_minutes;
        bVal = b.late_minutes;
        break;
      case 'fine':
        aVal = a.fine_type === 'per_order' ? a.fine_per_order : a.flat_fine;
        bVal = b.fine_type === 'per_order' ? b.fine_per_order : b.flat_fine;
        break;
      default: // 'id'
        aVal = a.id;
        bVal = b.id;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    return sortOrder === 'asc' ? 
      <ChevronUp className="h-3 w-3 ml-1 text-emerald-600" /> : 
      <ChevronDown className="h-3 w-3 ml-1 text-emerald-600" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_time':
        return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black">ON TIME</Badge>;
      case 'late':
        return <Badge className="bg-amber-50 text-amber-600 border-amber-100 font-black tracking-tight">WAITING REVIEW</Badge>;
      case 'late_minor':
        return <Badge className="bg-red-50 text-red-600 border-red-100 font-black">DENDA AKTIF</Badge>;
      case 'late_major':
        return <Badge className="bg-red-600 text-white border-red-700 font-black">MAJOR LATE</Badge>;
      case 'alpha':
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200 font-black">ALPHA</Badge>;
      case 'excused':
        return <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-black">DIMAAFKAN</Badge>;
      default:
        return <Badge>{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-emerald-600" />
            Monitoring Kehadiran
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Pantau status kehadiran kurir secara real-time hari ini.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchTodayLogs()}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            REFRESH DATA
          </button>
        </div>
      </div>

      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 flex items-center gap-5 group hover:scale-[1.02] transition-all duration-300">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
            <Clock className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">Total Online</p>
            <p className="text-3xl font-black text-gray-900 leading-none">
              {filteredLogs.filter(l => l.first_online_at).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 flex items-center gap-5 group hover:scale-[1.02] transition-all duration-300">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors duration-300">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">Tepat Waktu</p>
            <p className="text-3xl font-black text-emerald-600 leading-none">
              {filteredLogs.filter(l => l.status === 'on_time').length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 flex items-center gap-5 group hover:scale-[1.02] transition-all duration-300">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:bg-amber-600 transition-colors duration-300">
            <AlertCircle className="h-7 w-7 text-amber-600 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">Menunggu Review</p>
            <p className="text-3xl font-black text-amber-600 leading-none">
              {filteredLogs.filter(l => l.status === 'late' && !l.fine_type).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 flex items-center gap-5 group hover:scale-[1.02] transition-all duration-300">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center group-hover:bg-red-600 transition-colors duration-300">
            <AlertCircle className="h-7 w-7 text-red-600 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">Denda Aktif</p>
            <p className="text-3xl font-black text-red-600 leading-none">
              {filteredLogs.filter(l => l.fine_type).length}
            </p>
          </div>
        </div>
      </div>

      {/* Warning Section for Missing Couriers */}
      {missingCouriers.length > 0 && (
        <div className="space-y-3">
          
          {/* Warning menit ke-60: Critical */}
          {criticalMissing.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="text-xs font-black text-red-700 uppercase tracking-widest">
                  ⚠️ BELUM CHECK-IN — LEBIH DARI 60 MENIT
                </p>
                <span className="ml-auto text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                  {criticalMissing.length} kurir
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {criticalMissing.map(c => (
                  <div key={c.courier_id} 
                    className="bg-white border border-red-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-900">{c.courier_name}</p>
                      <p className="text-[10px] text-gray-400">
                        {c.shift_name} · mulai {c.shift_start_time.slice(0,5)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">{c.minutes_late} mnt</p>
                      <p className="text-[10px] text-red-400">terlambat</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning menit ke-1: Informational */}
          {warningMissing.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
                  BELUM CHECK-IN
                </p>
                <span className="ml-auto text-xs font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {warningMissing.length} kurir
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {warningMissing.map(c => (
                  <div key={c.courier_id}
                    className="bg-white border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-900">{c.courier_name}</p>
                      <p className="text-[10px] text-gray-400">
                        {c.shift_name} · mulai {c.shift_start_time.slice(0,5)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-600">{c.minutes_late} mnt</p>
                      <p className="text-[10px] text-amber-400">terlambat</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama kurir..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm font-medium"
          />
        </div>
        <div className="relative w-full md:w-64">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm font-black appearance-none"
          >
            <option value="all">SEMUA SHIFT</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('courier_name')}
                >
                  <div className="flex items-center">
                    Kurir {getSortIcon('courier_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('shift_name')}
                >
                  <div className="flex items-center">
                    Shift {getSortIcon('shift_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('first_online_at')}
                >
                  <div className="flex items-center">
                    Check In {getSortIcon('first_online_at')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('last_online_at')}
                >
                  <div className="flex items-center">
                    Selesai Shift {getSortIcon('last_online_at')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center">
                    Durasi {getSortIcon('duration')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status {getSortIcon('status')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('late_minutes')}
                >
                  <div className="flex items-center">
                    Keterangan {getSortIcon('late_minutes')}
                  </div>
                </th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('fine')}
                >
                  <div className="flex items-center">
                    Denda {getSortIcon('fine')}
                  </div>
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-6 py-8">
                      <div className="h-4 bg-gray-100 rounded-full w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <UserMinus className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Tidak ada data kehadiran</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  // Calculate duration if both check-in and shift-end are recorded
                  const duration = log.first_online_at && log.last_online_at
                    ? Math.round((new Date(log.last_online_at).getTime() - new Date(log.first_online_at).getTime()) / (1000 * 60))
                    : null;
                  
                  // Determine shift status based on duration
                  const getShiftStatus = () => {
                    if (!duration) return null;
                    const hours = duration / 60;
                    if (hours < 6.4) return { label: 'SELESAI AWAL', color: 'text-amber-600' }; // < 80% of 8 hours
                    if (hours > 9.6) return { label: 'OVERTIME', color: 'text-blue-600' }; // > 120% of 8 hours
                    return { label: 'NORMAL', color: 'text-emerald-600' };
                  };
                  
                  const shiftStatus = getShiftStatus();
                  
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black text-sm">
                            {log.courier_name?.charAt(0)}
                          </div>
                          <p className="font-black text-gray-900 tracking-tight">{log.courier_name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider">
                          {log.shift_name}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 font-bold text-gray-600 tabular-nums">
                        {log.first_online_at ? format(new Date(log.first_online_at), 'HH:mm') : '--:--'}
                      </td>
                      <td className="px-6 py-5 font-bold text-gray-600 tabular-nums">
                        {log.last_online_at ? format(new Date(log.last_online_at), 'HH:mm') : (
                          <span className="text-gray-300">--:--</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {duration ? (
                          <div>
                            <p className="font-bold text-gray-900 tabular-nums">
                              {Math.floor(duration / 60)}j {duration % 60}m
                            </p>
                            {shiftStatus && (
                              <p className={cn("text-[10px] font-bold", shiftStatus.color)}>
                                {shiftStatus.label}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-6 py-5">
                        {log.late_minutes > 0 ? (
                          <span className="text-xs font-bold text-red-500">
                            Terlambat {log.late_minutes} Menit
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {log.fine_type === 'per_order' && (
                          <div>
                            <p className="text-sm font-black text-red-600">
                              Rp {log.fine_per_order.toLocaleString('id')}/order
                            </p>
                            <p className="text-[10px] text-gray-400">dipotong per orderan</p>
                          </div>
                        )}
                        {log.fine_type === 'flat_major' && (
                          <p className="text-sm font-black text-red-600">
                            {formatCurrency(log.flat_fine)}
                          </p>
                        )}
                        {!log.fine_type && (
                          <p className="text-sm text-gray-300">-</p>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {needsAdminAction(log) ? (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => openFineDialog(log)}
                              disabled={actionLoading === log.id}
                              className="px-3 py-1.5 text-[10px] font-black bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 shadow-sm shadow-red-200"
                            >
                              {actionLoading === log.id ? '...' : 'APPLY DENDA'}
                            </button>
                            <button
                              onClick={() => handleExcuse(log)}
                              disabled={actionLoading === log.id}
                              className="px-3 py-1.5 text-[10px] font-black bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                            >
                              MAAFKAN
                            </button>
                          </div>
                        ) : log.status === 'excused' ? (
                          <span className="text-[10px] font-black text-emerald-600 tracking-widest uppercase">DIMAAFKAN</span>
                        ) : log.fine_type ? (
                          <span className="text-[10px] font-black text-red-500 tracking-widest uppercase">DENDA AKTIF</span>
                        ) : (
                          <span className="text-[10px] text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fine Dialog Modal */}
      <Modal
        isOpen={showFineDialog}
        onClose={() => {
          setShowFineDialog(false);
          setSelectedLog(null);
          setFineNotes('');
        }}
        title="Apply Denda Keterlambatan"
        size="md"
      >
        {selectedLog && (
          <div className="space-y-4">
            {/* Courier Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-600 mb-2">Kurir</p>
              <p className="text-lg font-black text-gray-900">{selectedLog.courier_name}</p>
              <p className="text-sm text-gray-500 mt-1">
                Terlambat <span className="font-bold text-red-600">{selectedLog.late_minutes} menit</span>
              </p>
            </div>

            {/* Fine Type (Auto-selected based on late_minutes) */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-bold text-amber-800 mb-2">Jenis Denda</p>
              {selectedLog.late_minutes >= 60 ? (
                <div>
                  <p className="text-lg font-black text-red-600">Flat Major (≥60 menit)</p>
                  <p className="text-sm text-gray-600 mt-1">Denda: Rp 30,000 (langsung ke settlement)</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-black text-amber-600">Per Order (&lt;60 menit)</p>
                  <p className="text-sm text-gray-600 mt-1">Denda: Rp 1,000 per orderan</p>
                </div>
              )}
            </div>

            {/* Notes Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Catatan / Alasan <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <textarea
                value={fineNotes}
                onChange={(e) => setFineNotes(e.target.value)}
                placeholder="Contoh: Terlambat tanpa pemberitahuan, tidak ada alasan yang jelas..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Catatan ini akan tersimpan dan dapat dilihat oleh kurir di riwayat kehadiran
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowFineDialog(false);
                  setSelectedLog(null);
                  setFineNotes('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleApplyFine(
                  selectedLog,
                  selectedLog.late_minutes >= 60 ? 'flat_major' : 'per_order'
                )}
                disabled={actionLoading === selectedLog.id}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading === selectedLog.id ? 'Memproses...' : 'Konfirmasi Denda'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
