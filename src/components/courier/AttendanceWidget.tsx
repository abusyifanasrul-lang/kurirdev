import { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAttendanceStore } from '@/stores/useAttendanceStore';

interface AttendanceWidgetProps {
  courierId: string;
  lateFineActive?: boolean;
}

export function AttendanceWidget({ courierId, lateFineActive }: AttendanceWidgetProps) {
  const navigate = useNavigate();
  const { todayLog, isLoading, fetchTodayLog, subscribeAttendance } = useAttendanceStore();
  const [isInShift, setIsInShift] = useState(false);

  useEffect(() => {
    if (courierId) {
      fetchTodayLog(courierId);
      
      // Subscribe to realtime attendance changes
      const unsubscribe = subscribeAttendance(courierId);
      
      return () => {
        unsubscribe();
      };
    }
  }, [courierId, fetchTodayLog, subscribeAttendance]);

  // Check if currently in shift time
  useEffect(() => {
    if (!todayLog?.shift_start || !todayLog?.shift_end) {
      setIsInShift(false);
      return;
    }

    const checkShiftTime = () => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

      // Parse shift times
      const [startHour, startMin] = todayLog.shift_start.split(':').map(Number);
      const [endHour, endMin] = todayLog.shift_end.split(':').map(Number);
      const shiftStart = startHour * 60 + startMin;
      const shiftEnd = endHour * 60 + endMin;

      // Check if currently in shift
      const inShift = currentTime >= shiftStart && currentTime < shiftEnd;
      setIsInShift(inShift);
    };

    checkShiftTime();
    const interval = setInterval(checkShiftTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [todayLog?.shift_start, todayLog?.shift_end]);

  // Don't show loading state - just hide widget if no data yet
  if (isLoading && !todayLog) {
    return null;
  }

  // Don't show widget if no shift today
  if (!todayLog) {
    return null;
  }

  // CRITICAL: Show widget if courier is late OR has active fine
  // Don't hide widget just because shift ended - fine might still be active
  if (!isInShift && !lateFineActive) {
    return null;
  }

  // Only show widget if courier is late OR has active fine
  const isLate = todayLog.status === 'late' || todayLog.status === 'late_minor' || todayLog.status === 'late_major' || lateFineActive;
  
  // Hide widget if courier is on time and no active fine
  if (!isLate && !lateFineActive) {
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
            {todayLog.shift_name || 'Shift Aktif'} • {todayLog.status === 'alpha' ? 'ALPHA - Tidak Check-In' : `Terlambat ${todayLog.late_minutes > 0 ? `${todayLog.late_minutes} menit` : ''}`}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}
