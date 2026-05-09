import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatter';

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

type DateFilter = 'current_month' | 'previous_month' | 'custom';

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

export function CourierAttendanceHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('current_month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
  useEffect(() => {
    if (!user?.id) return;

    const fetchAttendance = async () => {
      setIsLoading(true);
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

        // Map the data to match our interface
        const mappedData = (data || []).map((record: any) => ({
          ...record,
          shift: Array.isArray(record.shift) ? record.shift : (record.shift ? [record.shift] : null)
        })) as unknown as ShiftAttendance[];

        setAttendanceRecords(mappedData);
      } catch (err) {
        console.error('Failed to fetch attendance records:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [user?.id, dateRange]);

  // Calculate total fines for the period
  const totalFines = useMemo(() => {
    return attendanceRecords.reduce((sum, record) => {
      if (record.flat_fine_status === 'cancelled') return sum;
      
      let fineAmount = 0;
      if (record.fine_type === 'flat_major' || record.fine_type === 'flat_alpha') {
        fineAmount = record.flat_fine || 0;
      }
      // Note: per_order fines are deducted per order, not shown as flat amount here
      
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/courier')} 
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-[10px] font-bold text-gray-400 uppercase tracking-mobile leading-none">
              Riwayat Kehadiran
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-gray-900 leading-none">
                ATTENDANCE HISTORY
              </span>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex bg-gray-100/80 backdrop-blur-sm rounded-2xl p-1.5 gap-1.5 border border-gray-200/50 shadow-inner">
            <button 
              onClick={() => setDateFilter('current_month')}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
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
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
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
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
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
      </div>

      {/* Summary Card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 shadow-lg text-white">
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
      </div>

      {/* Attendance Records */}
      <div className="px-4 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
              <Calendar className="h-10 w-10 text-gray-200" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-tight">TIDAK ADA DATA</p>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Belum ada riwayat kehadiran untuk periode ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attendanceRecords.map((record) => {
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
