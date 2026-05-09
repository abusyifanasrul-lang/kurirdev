import { useEffect } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

  // Don't show loading state - just hide widget if no data yet
  if (isLoading && !todayLog) {
    return null;
  }

  // Don't show widget if no shift today
  if (!todayLog) {
    return null;
  }

  // Only show widget if courier is late
  const isLate = todayLog.status === 'late' || todayLog.status === 'late_minor' || todayLog.status === 'late_major' || lateFineActive;
  
  // Hide widget if courier is on time
  if (!isLate) {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/courier/profile', { state: { activeTab: 'attendance' } })}
      className="w-full bg-red-50/50 border border-red-200 hover:bg-red-50 rounded-2xl p-3 flex items-center justify-between transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-600" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate">
            {todayLog.shift_name || 'Shift Aktif'} • Terlambat {todayLog.late_minutes > 0 && `${todayLog.late_minutes} menit`}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}
