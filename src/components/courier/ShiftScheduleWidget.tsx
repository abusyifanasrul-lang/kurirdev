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

  // Update countdown every second
  useEffect(() => {
    if (!shiftInfo) return;

    const updateCountdown = () => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

      // Parse shift times
      const [startHour, startMin] = shiftInfo.start_time.split(':').map(Number);
      const [endHour, endMin] = shiftInfo.end_time.split(':').map(Number);
      const shiftStart = startHour * 60 + startMin;
      const shiftEnd = endHour * 60 + endMin;

      // Check if currently in shift
      if (currentTime >= shiftStart && currentTime < shiftEnd) {
        setIsInShift(true);
        setCountdown('');
      } else {
        setIsInShift(false);

        // Calculate time until next shift start
        let minutesUntilShift: number;
        
        if (currentTime < shiftStart) {
          // Shift is later today
          minutesUntilShift = shiftStart - currentTime;
        } else {
          // Shift is tomorrow
          minutesUntilShift = (24 * 60) - currentTime + shiftStart;
        }

        const hours = Math.floor(minutesUntilShift / 60);
        const minutes = minutesUntilShift % 60;

        if (hours > 0) {
          setCountdown(`${hours}j ${minutes}m`);
        } else {
          setCountdown(`${minutes}m`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [shiftInfo]);

  if (isLoading || !shiftInfo) return null;

  return (
    <div className={cn(
      "bg-white rounded-2xl xs:rounded-3xl p-4 mini:p-5 shadow-sm border transition-all",
      isInShift 
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" 
        : "border-gray-100"
    )}>
      <div className="flex items-center justify-between gap-3">
        {/* Left: Shift Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
            isInShift 
              ? "bg-emerald-100 text-emerald-600 border-emerald-200" 
              : "bg-gray-50 text-gray-400 border-gray-100"
          )}>
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.15em] mb-0.5">
              Jadwal Shift
            </p>
            <p className="text-sm font-black text-gray-900 leading-tight">
              {shiftInfo.name}
            </p>
            <p className="text-xs font-bold text-gray-500 mt-0.5">
              {shiftInfo.start_time} - {shiftInfo.end_time}
            </p>
          </div>
        </div>

        {/* Right: Status or Countdown */}
        <div className="flex-shrink-0">
          {isInShift ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-200">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider whitespace-nowrap">
                Sedang Shift
              </p>
            </div>
          ) : countdown ? (
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-0.5">
                <Clock className="h-3 w-3 text-orange-500" />
                <p className="text-xs font-black text-orange-600 tabular-nums">
                  {countdown}
                </p>
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                Menuju Shift
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
