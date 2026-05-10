import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/utils/cn';

interface ShiftScheduleWidgetProps {
  courierId: string;
}

interface ShiftInfo {
  name: string;
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
}

export function ShiftScheduleWidget({ courierId }: ShiftScheduleWidgetProps) {
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isInShift, setIsInShift] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        console.error('[ShiftScheduleWidget] Failed to fetch shift:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShiftInfo();
  }, [courierId]);

  // Update countdown in real-time
  useEffect(() => {
    if (!shiftInfo) return;

    const updateCountdown = () => {
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
    updateCountdown();
    
    // Update every second for real-time countdown
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [shiftInfo]);

  if (isLoading || !shiftInfo) return null;

  return (
    <div className={cn(
      "bg-white rounded-2xl xs:rounded-3xl px-4 mini:px-5 py-3 mini:py-3.5 shadow-sm border transition-all",
      isInShift 
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" 
        : "border-gray-100"
    )}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Shift Time */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            isInShift 
              ? "bg-emerald-100 text-emerald-600" 
              : "bg-gray-50 text-gray-400"
          )}>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase font-black text-gray-400 tracking-[0.15em] leading-none mb-1">
              Jadwal Shift
            </p>
            <p className="text-sm font-black text-gray-900 leading-none">
              {shiftInfo.start_time} - {shiftInfo.end_time}
            </p>
          </div>
        </div>

        {/* Right: Countdown or Status */}
        <div className="flex-shrink-0 text-right">
          {isInShift ? (
            <div className="px-3 py-1 rounded-lg bg-emerald-100">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider whitespace-nowrap leading-none">
                Sedang Shift
              </p>
            </div>
          ) : countdown ? (
            <>
              <div className="flex items-center gap-1 justify-end mb-0.5">
                <Clock className="h-3 w-3 text-orange-500" />
                <p className="text-xs font-black text-orange-600 tabular-nums leading-none">
                  {countdown}
                </p>
              </div>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight leading-none">
                Menuju Shift
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
