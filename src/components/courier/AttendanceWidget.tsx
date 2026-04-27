import { useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAttendanceStore } from '@/stores/useAttendanceStore';
import { formatCurrency } from '@/utils/formatter';

interface AttendanceWidgetProps {
  courierId: string;
  lateFineActive?: boolean;
}

export function AttendanceWidget({ courierId, lateFineActive }: AttendanceWidgetProps) {
  const { todayLog, isLoading, fetchTodayLog } = useAttendanceStore();

  useEffect(() => {
    if (courierId) {
      fetchTodayLog(courierId);
    }
  }, [courierId, fetchTodayLog]);

  if (isLoading && !todayLog) {
    return (
      <div className="animate-pulse bg-white/50 backdrop-blur-md rounded-3xl p-4 h-24 border border-gray-100" />
    );
  }

  if (!todayLog) {
    return (
      <div className="bg-amber-50/50 backdrop-blur-md border border-amber-100 rounded-3xl p-4 mini:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-0.5">Jadwal Shift</p>
            <p className="text-xs font-bold text-amber-600 leading-tight">Kamu belum mulai shift hari ini.</p>
          </div>
        </div>
      </div>
    );
  }

  const isLate = todayLog.status === 'late' || lateFineActive;
  const statusColor = isLate ? 'text-red-600' : 'text-emerald-600';
  const statusBg = isLate ? 'bg-red-50' : 'bg-emerald-50';
  const StatusIcon = isLate ? AlertCircle : CheckCircle2;

  return (
    <div className={cn(
      "relative overflow-hidden backdrop-blur-md rounded-3xl p-4 mini:p-5 shadow-sm border transition-all",
      isLate ? "bg-white border-red-100" : "bg-white border-emerald-100"
    )}>
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-[0.03]">
        <Clock className="w-24 h-24 rotate-12" />
      </div>

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border",
            statusBg,
            isLate ? "border-red-100" : "border-emerald-100"
          )}>
            <StatusIcon className={cn("h-6 w-6", statusColor)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Shift Sekarang</p>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                statusBg, statusColor
              )}>
                {todayLog.status.replace('_', ' ')}
              </span>
            </div>
            <h3 className="text-sm font-black text-gray-900 leading-tight truncate">
              {todayLog.shift_name || 'Shift Aktif'}
            </h3>
            <p className="text-[10px] font-bold text-gray-500 mt-0.5">
              {todayLog.shift_start?.slice(0, 5)} - {todayLog.shift_end?.slice(0, 5)}
            </p>
          </div>
        </div>

        {isLate && (
          <div className="flex flex-col items-end gap-1">
            <div className="bg-red-600 px-3 py-1.5 rounded-xl shadow-lg shadow-red-100 flex items-center gap-1.5">
              <MinusCircle className="h-3 w-3 text-white" />
              <p className="text-[10px] font-black text-white whitespace-nowrap uppercase tracking-tight">
                Potong Denda
              </p>
            </div>
            <p className="text-[9px] font-bold text-red-500 text-right leading-none mt-1">
              Setiap Pesanan
            </p>
          </div>
        )}
      </div>

      {isLate && todayLog.late_minutes > 0 && (
        <div className="mt-4 pt-3 border-t border-red-50 flex items-center justify-between text-[10px]">
          <span className="font-bold text-gray-400 uppercase tracking-wider">Keterlambatan</span>
          <span className="font-black text-red-600">{todayLog.late_minutes} Menit</span>
        </div>
      )}
    </div>
  );
}
