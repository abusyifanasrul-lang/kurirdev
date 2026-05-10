import { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAttendanceStore } from '@/stores/useAttendanceStore';
import { cn } from '@/utils/cn';

interface ShiftStatusWidgetProps {
  courierId: string;
  lateFineActive?: boolean;
}

interface ShiftInfo {
  name: string;
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
}

export function ShiftStatusWidget({ courierId, lateFineActive }: ShiftStatusWidgetProps) {
  const navigate = useNavigate();
  const { todayLog, isLoading, fetchTodayLog, subscribeAttendance } = useAttendanceStore();
  
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isInShift, setIsInShift] = useState(false);
  const [isShiftLoading, setIsShiftLoading] = useState(true);

  // Fetch shift info
  useEffect(() => {
    const fetchShiftInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('shifts(name, start_time, end_time)')
          .eq('id', courierId)
          .single();

        if (error) throw error;

        if (data?.shifts) {
          setShiftInfo(data.shifts as any);
        }
      } catch (err) {
        console.error('[ShiftStatusWidget] Failed to fetch shift:', err);
      } finally {
        setIsShiftLoading(false);
      }
    };

    fetchShiftInfo();
  }, [courierId]);

  // Fetch attendance data and subscribe to changes
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

  // Update countdown and shift status in real-time
  // OPTIMIZED: Only update when tab is visible to reduce CPU usage
  useEffect(() => {
    if (!shiftInfo) return;

    const updateStatus = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentSec = now.getSeconds();
      const currentTimeInSeconds = currentHour * 3600 + currentMin * 60 + currentSec;

      // Parse shift times
      const [startHour, startMin] = shiftInfo.start_time.split(':').map(Number);
      const [endHour, endMin] = shiftInfo.end_time.split(':').map(Number);
      const shiftStartInSeconds = startHour * 3600 + startMin * 60;
      const shiftEndInSeconds = endHour * 3600 + endMin * 60;

      // Check if currently in shift
      if (currentTimeInSeconds >= shiftStartInSeconds && currentTimeInSeconds < shiftEndInSeconds) {
        setIsInShift(true);
        setCountdown('');
      } else {
        setIsInShift(false);

        // Calculate seconds until next shift start
        let secondsUntilShift: number;
        
        if (currentTimeInSeconds < shiftStartInSeconds) {
          // Shift is later today
          secondsUntilShift = shiftStartInSeconds - currentTimeInSeconds;
        } else {
          // Shift is tomorrow
          secondsUntilShift = (24 * 3600) - currentTimeInSeconds + shiftStartInSeconds;
        }

        const hours = Math.floor(secondsUntilShift / 3600);
        const minutes = Math.floor((secondsUntilShift % 3600) / 60);
        const seconds = secondsUntilShift % 60;

        // Format countdown based on time remaining
        if (hours > 0) {
          setCountdown(`${hours}j ${minutes}m`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}m ${seconds}d`);
        } else {
          setCountdown(`${seconds}d`);
        }
      }
    };

    // Initial update
    updateStatus();
    
    // Update every second for real-time countdown
    // CRITICAL FIX: Pause updates when tab is not visible
    let interval: NodeJS.Timeout | null = null;
    
    const startInterval = () => {
      if (interval) return; // Already running
      interval = setInterval(() => {
        // Double-check visibility before updating
        if (document.visibilityState === 'visible') {
          updateStatus();
        }
      }, 1000);
    };
    
    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    
    // Start interval if tab is visible
    if (document.visibilityState === 'visible') {
      startInterval();
    }
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateStatus(); // Update immediately when tab becomes visible
        startInterval();
      } else {
        stopInterval();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shiftInfo]);

  // Don't show loading state - just hide widget if no data yet
  if ((isLoading && !todayLog) || (isShiftLoading && !shiftInfo)) {
    return null;
  }

  // Don't show widget if no shift today
  if (!shiftInfo) {
    return null;
  }

  // Determine widget state and appearance
  const isLate = todayLog?.status === 'late' || todayLog?.status === 'late_minor' || todayLog?.status === 'late_major' || lateFineActive;
  const isExcused = todayLog?.status === 'excused';
  
  // Priority: Late > In Shift > Countdown
  let widgetState: 'late' | 'excused' | 'in_shift' | 'countdown' = 'countdown';
  
  if (isLate && (isInShift || lateFineActive)) {
    widgetState = 'late';
  } else if (isExcused && (isInShift || lateFineActive)) {
    widgetState = 'excused';
  } else if (isInShift) {
    widgetState = 'in_shift';
  } else {
    widgetState = 'countdown';
  }

  // Widget styling based on state
  const getWidgetStyle = () => {
    switch (widgetState) {
      case 'late':
        return {
          container: "bg-red-50/50 border-red-200 hover:bg-red-50",
          icon: "bg-red-50 text-red-600",
          iconComponent: AlertCircle,
          clickable: true
        };
      case 'excused':
        return {
          container: "bg-green-50/50 border-green-200 hover:bg-green-50",
          icon: "bg-green-50 text-green-600",
          iconComponent: AlertCircle,
          clickable: true
        };
      case 'in_shift':
        return {
          container: "bg-emerald-50 border-emerald-200",
          icon: "bg-emerald-100 text-emerald-600",
          iconComponent: Calendar,
          clickable: false
        };
      default: // countdown
        return {
          container: "bg-white border-gray-100",
          icon: "bg-gray-50 text-gray-400",
          iconComponent: Calendar,
          clickable: false
        };
    }
  };

  const style = getWidgetStyle();

  // Widget content based on state
  const getWidgetContent = () => {
    switch (widgetState) {
      case 'late':
        return {
          title: `${todayLog?.shift_name || shiftInfo.name} • Terlambat ${todayLog?.late_minutes || 0} menit`,
          subtitle: `${shiftInfo.start_time} - ${shiftInfo.end_time}`,
          rightContent: <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        };
      case 'excused':
        return {
          title: `${todayLog?.shift_name || shiftInfo.name} • Dimaafkan`,
          subtitle: `${shiftInfo.start_time} - ${shiftInfo.end_time}`,
          rightContent: <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        };
      case 'in_shift':
        return {
          title: `${shiftInfo.start_time} - ${shiftInfo.end_time}`,
          subtitle: 'Jadwal Shift',
          rightContent: (
            <div className="px-3 py-1 rounded-lg bg-emerald-100">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider whitespace-nowrap leading-none">
                Sedang Shift
              </p>
            </div>
          )
        };
      default: // countdown
        return {
          title: `${shiftInfo.start_time} - ${shiftInfo.end_time}`,
          subtitle: 'Jadwal Shift',
          rightContent: countdown ? (
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-0.5">
                <Clock className="h-3 w-3 text-orange-500" />
                <p className="text-xs font-black text-orange-600 tabular-nums leading-none">
                  {countdown}
                </p>
              </div>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight leading-none">
                Menuju Shift
              </p>
            </div>
          ) : null
        };
    }
  };

  const content = getWidgetContent();
  const IconComponent = style.iconComponent;

  const handleClick = () => {
    if (style.clickable) {
      navigate('/courier/profile', { state: { activeTab: 'attendance' } });
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "rounded-2xl xs:rounded-3xl px-4 mini:px-5 py-3 mini:py-3.5 shadow-sm border transition-all",
        style.container,
        style.clickable ? "cursor-pointer active:scale-[0.98]" : ""
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Icon + Content */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            style.icon
          )}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase font-black text-gray-400 tracking-[0.15em] leading-none mb-1">
              {content.subtitle}
            </p>
            <p className="text-sm font-black text-gray-900 leading-none">
              {content.title}
            </p>
          </div>
        </div>

        {/* Right: Status/Countdown */}
        <div className="flex-shrink-0">
          {content.rightContent}
        </div>
      </div>
    </div>
  );
}