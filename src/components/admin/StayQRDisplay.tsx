import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Clock, CheckCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

interface StayLog {
  id: string;
  courier_name: string | null;
  verified_at: string | null;
}

export function StayQRDisplay() {
  const { user } = useAuth();
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [todayLogs, setTodayLogs] = useState<StayLog[]>([]);
  const [lastScannedBy, setLastScannedBy] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const QR_EXPIRY_MINUTES = 5;

  const generateNewToken = useCallback(async () => {
    if (!user?.id || isGenerating) return;
    setIsGenerating(true);
    setLastScannedBy(null);

    try {
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000);

      const { data, error } = await supabase
        .from('stay_qr_tokens')
        .insert({
          token,
          created_by: user.id,
          expires_at: expires.toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to generate QR token:', error);
        return;
      }

      setActiveToken(token);
      setTokenId(data.id);
      setExpiresAt(expires);
    } finally {
      setIsGenerating(false);
    }
  }, [user?.id, isGenerating]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = expiresAt.getTime() - now;

      if (remaining <= 0) {
        setCountdown('Kedaluwarsa');
        setActiveToken(null);
        setTokenId(null);
        clearInterval(interval);
        // Auto-generate new token
        generateNewToken();
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, generateNewToken]);

  // Subscribe to realtime changes for auto-regenerate
  useEffect(() => {
    // Listen to ALL attendance logs inserts. When ANY courier succeeds, 
    // we want to refresh our logs and regenerate a new QR code for the next one.
    const channel = supabase
      .channel('stay-attendance-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stay_attendance_logs',
        },
        (payload) => {
          console.log('New stay attendance detected:', payload);
          // Refresh list and generate new QR immediately
          fetchTodayLogs();
          generateNewToken();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [generateNewToken, fetchTodayLogs]);

  // Fetch today's attendance logs
  const fetchTodayLogs = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('stay_attendance_logs')
      .select('id, courier_name, verified_at')
      .gte('verified_at', todayStart.toISOString())
      .order('verified_at', { ascending: false });

    if (data) {
      setTodayLogs(data);
      if (data.length > 0) {
        setLastScannedBy(data[0].courier_name);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    generateNewToken();
    fetchTodayLogs();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* QR Code Display Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">QR Stay Verification</h3>
            <p className="text-xs text-gray-500 mt-0.5">Kurir scan QR ini untuk aktivasi STAY</p>
          </div>
          <button
            onClick={generateNewToken}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            Generate Baru
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* QR Code */}
          {activeToken ? (
            <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-inner">
              <QRCodeSVG
                value={activeToken}
                size={280}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>
          ) : (
            <div className="w-[312px] h-[312px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 text-gray-300 mx-auto mb-2 animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Generating QR...</p>
              </div>
            </div>
          )}

          {/* Countdown Timer */}
          <div className="mt-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-600 tabular-nums">
              {countdown || '--:--'}
            </span>
            <span className="text-xs text-gray-400">tersisa</span>
          </div>

          {/* Last scanned notification */}
          {lastScannedBy && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-700">
                ✅ {lastScannedBy} baru saja check-in STAY
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Today's Attendance Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Log Absensi Hari Ini</h3>
          </div>
          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
            {todayLogs.length} kurir
          </span>
        </div>

        <div className="divide-y divide-gray-50">
          {todayLogs.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400 font-medium">Belum ada kurir yang Stay hari ini</p>
            </div>
          ) : (
            todayLogs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs">
                    {(log.courier_name || '?').charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{log.courier_name || 'Unknown'}</span>
                </div>
                <span className="text-xs font-bold text-gray-400 tabular-nums">
                  {formatTime(log.verified_at || new Date().toISOString())}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
