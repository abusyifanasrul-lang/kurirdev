import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { supabase } from '@/lib/supabaseClient';
import { useSessionStore } from '@/stores/useSessionStore';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierId: string;
}

type ScanState = 'scanning' | 'verifying' | 'success' | 'error';

export function QRScannerModal({ isOpen, onClose, courierId }: QRScannerModalProps) {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // Only stop if scanner is actually scanning (state 2 = SCANNING)
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }
  }, []);

  const handleVerify = useCallback(async (token: string) => {
    // Prevent duplicate processing or processing after success/verifying
    if (isProcessingRef.current || scanState === 'verifying' || scanState === 'success') return;
    isProcessingRef.current = true;

    setScanState('verifying');

    try {
      const { data, error } = await supabase.rpc('verify_stay_qr', {
        p_token: token,
        p_courier_id: courierId,
      });

      if (error) {
        setScanState('error');
        setErrorMessage(error.message || 'Gagal verifikasi. Coba lagi.');
        isProcessingRef.current = false;
        return;
      }

      const result = data as unknown as { success: boolean; message?: string; error?: string; courier_name?: string } | null;

      if (result?.success) {
        setScanState('success');
        setSuccessMessage(result.message || 'Status STAY aktif!');
        
        // Ensure scanner is stopped
        await stopScanner();

        useSessionStore.getState().updateUser({
          is_online: true,
          courier_status: 'stay' as any,
        });

        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setScanState('error');
        // Explicitly check for invalid token vs other errors
        const msg = result?.error || 'QR Code tidak valid.';
        setErrorMessage(msg);
        
        // Delay resetting processing to prevent instant re-scans of same failed QR
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1000);
      }
    } catch {
      setScanState('error');
      setErrorMessage('Koneksi gagal. Periksa internet kamu.');
      isProcessingRef.current = false;
    }
  }, [courierId, onClose, scanState, stopScanner]);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setScanState('scanning');
    setErrorMessage('');
    setCameraError(false);
    isProcessingRef.current = false;

    try {
      await stopScanner();

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Immediately set processing to true to block further callbacks
          if (isProcessingRef.current) return;
          
          // QR scanned successfully
          // Don't await stopScanner here to avoid UI hang, call it inside handleVerify
          handleVerify(decodedText);
        },
        () => {
          // Scan error (no QR found in frame) — ignored
        }
      );
    } catch {
      setCameraError(true);
      setScanState('error');
      setErrorMessage('Tidak bisa mengakses kamera. Izinkan akses kamera di pengaturan HP.');
    }
  }, [stopScanner, handleVerify]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to let the DOM render before starting scanner
      const timeout = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      stopScanner();
      setScanState('scanning');
      setErrorMessage('');
      setSuccessMessage('');
      isProcessingRef.current = false;
    }
  }, [isOpen, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-xl flex flex-col items-center justify-center z-[100] animate-in fade-in duration-300">
      {/* Header */}
      <div className="w-full max-w-sm px-5 mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white tracking-tight">Scan QR Code</h3>
          <p className="text-xs text-gray-400 font-medium">Arahkan kamera ke QR di layar admin</p>
        </div>
        <button
          onClick={() => { stopScanner(); onClose(); }}
          className="p-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="w-full max-w-sm px-5">
        <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
          {/* Camera viewfinder - ALWAYS visible during scanning and verifying to prevent flicker */}
          <div
            ref={containerRef}
            id="qr-reader"
            className={cn(
              "w-full aspect-square",
              (scanState === 'success' || (scanState === 'error' && cameraError)) && "hidden"
            )}
          />

          {/* Verifying Overlay */}
          {scanState === 'verifying' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm gap-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Memverifikasi...</p>
            </div>
          )}

          {/* Success State Overlay */}
          {scanState === 'success' && (
            <div className="w-full aspect-square flex flex-col items-center justify-center bg-gray-900 gap-4 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
              <div className="text-center px-6">
                <p className="text-base font-black text-emerald-400 uppercase tracking-widest mb-1">Berhasil!</p>
                <p className="text-xs text-gray-400 font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error State Overlay (camera error) */}
          {(scanState === 'error' && cameraError) && (
            <div className="w-full aspect-square flex flex-col items-center justify-center bg-gray-900 gap-4 px-8 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Camera className="h-8 w-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-red-400 uppercase tracking-wider mb-1">Kamera Tidak Tersedia</p>
                <p className="text-xs text-gray-400 font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Viewfinder overlay corners (only during scanning) */}
          {scanState === 'scanning' && !cameraError && (
            <div className="absolute inset-0 pointer-events-none animate-in fade-in duration-500">
              {/* Corner markers */}
              <div className="absolute top-8 left-8 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-8 right-8 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-8 left-8 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-8 right-8 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
            </div>
          )}
        </div>
      </div>

      {/* Error Banner (QR invalid, not camera error) */}
      {scanState === 'error' && !cameraError && (
        <div className="w-full max-w-sm px-5 mt-4 animate-in slide-in-from-top-2">
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-red-300">{errorMessage}</p>
              <button
                onClick={startScanner}
                className="mt-2 text-xs font-bold text-red-400 underline underline-offset-2"
              >
                Coba scan lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry button for camera error */}
      {scanState === 'error' && cameraError && (
        <div className="w-full max-w-sm px-5 mt-4">
          <button
            onClick={startScanner}
            className="w-full py-4 bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
}
