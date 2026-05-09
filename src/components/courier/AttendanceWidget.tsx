import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { useAttendanceStore } from '@/stores/useAttendanceStore';

interface AttendanceWidgetProps {
  courierId: string;
  lateFineActive?: boolean;
}

export function AttendanceWidget({ courierId, lateFineActive }: AttendanceWidgetProps) {
  const navigate = useNavigate();
  const { todayLog, isLoading, fetchTodayLog } = useAttendanceStore();

  useEffect(() => {
    if (courierId) {
      fetchTodayLog(courierId);
    }
  }, [courierId, fetchTodayLog]);

  if (isLoading && !todayLog) {
    return (
      <div className="animate-pulse bg-white/50 backdrop-blur-md rounded-2xl p-3 h-16 border border-gray-100" />
    );
  }

  if (!todayLog) {
    return (
      <button
        onClick={() => navigate('/courier/profile', { state: { activeTab: 'attendance' } })}
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center justify-between hover:bg-gray-100 transition-colors active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-gray-600">Belum mulai shift</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>
    );
  }

  const isLate = todayLog.status === 'late' || todayLog.status === 'late_minor' || todayLog.status === 'late_major' || lateFineActive;
  const StatusIcon = isLate ? AlertCircle : CheckCircle2;
  const iconColor = isLate ? 'text-red-600' : 'text-emerald-600';
  const iconBg = isLate ? 'bg-red-50' : 'bg-emerald-50';

  return (
    <button
      onClick={() => navigate('/courier/profile', { state: { activeTab: 'attendance' } })}
      className={cn(
        "w-full rounded-2xl p-3 flex items-center justify-between transition-all active:scale-[0.98] border",
        isLate 
          ? "bg-red-50/50 border-red-200 hover:bg-red-50" 
          : "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
          iconBg
        )}>
          <StatusIcon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="text-left min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate">
            {todayLog.shift_name || 'Shift Aktif'} • {isLate ? 'Terlambat' : 'Tepat Waktu'} {isLate && todayLog.late_minutes > 0 && `${todayLog.late_minutes} menit`}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}
