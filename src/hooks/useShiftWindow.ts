import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ShiftWindowStatus {
  isWithinWindow: boolean;
  shiftName: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  isLoading: boolean;
}

/**
 * Hook to check if current time is within shift check-in window
 * Window: 1 hour before shift start until shift end
 */
export function useShiftWindow(courierId: string | undefined): ShiftWindowStatus {
  const [status, setStatus] = useState<ShiftWindowStatus>({
    isWithinWindow: false,
    shiftName: null,
    windowStart: null,
    windowEnd: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!courierId) {
      setStatus({ isWithinWindow: false, shiftName: null, windowStart: null, windowEnd: null, isLoading: false });
      return;
    }

    const checkShiftWindow = async () => {
      try {
        // Get courier's shift
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('shift_id')
          .eq('id', courierId)
          .single();

        if (profileError || !profile?.shift_id) {
          setStatus({ isWithinWindow: false, shiftName: null, windowStart: null, windowEnd: null, isLoading: false });
          return;
        }

        // Get shift details
        const { data: shift, error: shiftError } = await supabase
          .from('shifts')
          .select('name, start_time, end_time, is_overnight, is_active')
          .eq('id', profile.shift_id)
          .single();

        if (shiftError || !shift || !shift.is_active) {
          setStatus({ isWithinWindow: false, shiftName: null, windowStart: null, windowEnd: null, isLoading: false });
          return;
        }

        // Get settings for check-in window
        const { data: settings } = await supabase
          .from('settings')
          .select('check_in_window_minutes, operational_timezone')
          .single();

        const checkInWindowMinutes = settings?.check_in_window_minutes || 60;
        const operationalTz = settings?.operational_timezone || 'Asia/Makassar';

        // Calculate shift window (simplified client-side check)
        const now = new Date();
        const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // Parse shift times
        const shiftStart = new Date(`${today}T${shift.start_time}`);
        const windowStart = new Date(shiftStart.getTime() - checkInWindowMinutes * 60 * 1000);
        
        let shiftEnd: Date;
        if (shift.is_overnight) {
          // Overnight shift: end time is on next day
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
          shiftEnd = new Date(`${tomorrowStr}T${shift.end_time}`);
        } else {
          shiftEnd = new Date(`${today}T${shift.end_time}`);
        }

        const isWithinWindow = now >= windowStart && now <= shiftEnd;

        setStatus({
          isWithinWindow,
          shiftName: shift.name,
          windowStart: windowStart.toISOString(),
          windowEnd: shiftEnd.toISOString(),
          isLoading: false,
        });
      } catch (error) {
        console.error('[useShiftWindow] Error checking shift window:', error);
        setStatus({ isWithinWindow: false, shiftName: null, windowStart: null, windowEnd: null, isLoading: false });
      }
    };

    checkShiftWindow();

    // Re-check every minute
    const interval = setInterval(checkShiftWindow, 60000);

    return () => clearInterval(interval);
  }, [courierId]);

  return status;
}
