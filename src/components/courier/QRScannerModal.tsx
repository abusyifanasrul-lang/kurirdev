/**
 * QRScannerModal.tsx — Refactored
 *
 * Fix yang diterapkan:
 * 1. React Portal — overlay dirender LANGSUNG ke document.body,
 *    bukan di dalam #root yang di-hide CSS → solusi white screen
 * 2. scanState dihapus dari deps handleVerify → pakai isProcessingRef saja
 * 3. useSessionStore pakai selector, bukan getState()
 * 4. Double useEffect cleanup → digabung jadi satu
 * 5. CSS: opacity hanya pada #root, tidak pada html/body
 * 6. onAnimationEnd gantikan setTimeout 300ms yang tidak reliable
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import jsQR from 'jsqr';
import { X, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSessionStore } from '@/stores/useSessionStore';
import './qr-scanner.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierId: string;
}

type ScanState = 'scanning' | 'verifying' | 'success' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function QRScannerModal({ isOpen, onClose, courierId }: QRScannerModalProps) {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const [isReady, setIsReady] = useState(false); // Controls when to start scanner

  const isNative = Capacitor.isNativePlatform();

  // ─── FIX #3: Zustand selector (bukan getState() langsung) ────────────────
  const updateUser = useSessionStore(state => state.updateUser);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isProcessingRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  // ─── CLEANUP ──────────────────────────────────────────────────────────────

  const stopWebScanner = useCallback(() => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopNativeScanner = useCallback(async () => {
    try {
      // Restore UI PERTAMA sebelum stopScan()
      // Jika dibalik, ada frame di mana kamera visible tapi #root belum kembali
      document.body.classList.remove('scanner-active');
      document.documentElement.classList.remove('scanner-active');
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch (e) {
      // Sudah dihentikan sebelumnya — abaikan error
      console.warn('[QRScanner] stopNativeScan warning:', e);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (isNative) {
      await stopNativeScanner();
    } else {
      stopWebScanner();
    }
  }, [isNative, stopNativeScanner, stopWebScanner]);

  // ─── VERIFICATION ─────────────────────────────────────────────────────────

  // ─── FIX #2: Hapus scanState dari deps — isProcessingRef sebagai guard ───
  const handleVerify = useCallback(async (token: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Stop scanner sebelum network call
    await stopScanner();
    setScanState('verifying');

    try {
      // M2 Fix: Delegasi ke store yang menangani RPC + native service start
      const result = await useCourierStore.getState().setCourierStay(courierId, token);

      if (result.success) {
        setScanState('success');
        setSuccessMessage('Status STAY aktif!');

        updateUser({
          is_online: true,
          courier_status: 'stay',
        });

        setTimeout(() => onClose(), 2000);
      } else {
        setScanState('error');
        setErrorMessage('QR Code tidak valid.');
        isProcessingRef.current = false;
      }
    } catch (err: any) {
      setScanState('error');
      setErrorMessage(err?.message || 'Koneksi gagal. Periksa internet kamu.');
      isProcessingRef.current = false;
    }
  }, [courierId, onClose, stopScanner, updateUser]);
  // ↑ scanState TIDAK ada di sini lagi

  // ─── WEB SCANNER ──────────────────────────────────────────────────────────

  const startWebScanner = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      const e = err as DOMException;
      setCameraError(true);
      setScanState('error');
      setErrorMessage(
        e.name === 'NotAllowedError'
          ? 'Izin kamera ditolak di browser.'
          : 'Tidak bisa mengakses kamera browser.',
      );
      return;
    }

    videoRef.current.srcObject = stream;
    videoRef.current.setAttribute('playsinline', 'true');
    await videoRef.current.play();

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tick = (timestamp: number) => {
      if (isProcessingRef.current) return;

      if (timestamp - lastScanTimeRef.current >= 150) {
        lastScanTimeRef.current = timestamp;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code?.data) {
            handleVerify(code.data);
            return; // rAF berhenti setelah ini
          }
        }
      }
      animationFrameIdRef.current = requestAnimationFrame(tick);
    };
    animationFrameIdRef.current = requestAnimationFrame(tick);
  }, [handleVerify]);

  // ─── NATIVE SCANNER ───────────────────────────────────────────────────────

  const startNativeScanner = useCallback(async () => {
    // ─── FIX #1 dari review sebelumnya: checkPermissions dulu ────────────
    const { camera: currentStatus } = await BarcodeScanner.checkPermissions();

    if (currentStatus === 'denied') {
      setCameraError(true);
      setScanState('error');
      setErrorMessage('Izin kamera ditolak. Aktifkan di Pengaturan.');
      await BarcodeScanner.openSettings();
      return;
    }

    if (currentStatus !== 'granted') {
      const { camera: newStatus } = await BarcodeScanner.requestPermissions();
      if (newStatus !== 'granted') {
        setScanState('error');
        setErrorMessage('Izin kamera diperlukan untuk scan.');
        return;
      }
    }

    // ─── FIX WHITE SCREEN: Tambahkan class SEBELUM startScan() ───────────
    // Jika diletakkan sesudah, ada 1-2 frame kosong putih saat transisi
    document.body.classList.add('scanner-active');
    document.documentElement.classList.add('scanner-active');

    // Tunggu satu frame agar CSS opacity diterapkan browser
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    await BarcodeScanner.removeAllListeners();
    await BarcodeScanner.addListener('barcodesScanned', result => {
      const first = result.barcodes?.[0];
      if (first?.rawValue) {
        handleVerify(first.rawValue);
      }
    });

    await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });
  }, [handleVerify]);

  // ─── START SCANNER ────────────────────────────────────────────────────────

  const startScanner = useCallback(async () => {
    setScanState('scanning');
    setErrorMessage('');
    setCameraError(false);
    isProcessingRef.current = false;
    lastScanTimeRef.current = 0;

    try {
      if (isNative) {
        await startNativeScanner();
      } else {
        await startWebScanner();
      }
    } catch (err) {
      setCameraError(true);
      setScanState('error');
      setErrorMessage('Gagal memulai scanner. Coba lagi.');
      isProcessingRef.current = false;
    }
  }, [isNative, startNativeScanner, startWebScanner]);

  const handleRetry = useCallback(() => {
    startScanner();
  }, [startScanner]);

  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  // ─── FIX #4: Satu useEffect, tidak dobel ──────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    // Reset state saat modal dibuka
    setIsReady(false);
    setScanState('scanning');
    setErrorMessage('');
    setCameraError(false);

    return () => {
      // Cleanup saat isOpen berubah atau unmount
      stopScanner();
      isProcessingRef.current = false;
      setIsReady(false);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ Sengaja tidak masukkan stopScanner — fungsi ini stabil dan
  //   tidak perlu menjadi trigger re-run effect

  // ─── FIX #6: Mulai scanner saat isReady (dipicu onAnimationEnd) ──────────

  useEffect(() => {
    if (isReady) {
      startScanner();
    }
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── FIX WHITE SCREEN (utama): Render via Portal langsung ke body ────────
  // Overlay ini hidup DI LUAR #root, sehingga saat #root di-opacity:0,
  // overlay ini tetap terlihat karena tidak ter-affect oleh CSS cascade-nya
  return createPortal(
    <div
      className={[
        'qrs-overlay-portal',
        isNative && scanState === 'scanning'
          ? 'qrs--native-mode'
          : 'qrs--web-mode',
      ].join(' ')}
      // ─── FIX #6: Trigger startScanner setelah animasi masuk selesai ────
      onAnimationEnd={() => {
        if (!isReady) setIsReady(true);
      }}
      style={{ animation: 'qrs-fadein 0.2s ease forwards' }}
    >
      <style>{`@keyframes qrs-fadein { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="qrs-header">
        <div>
          <h3 style={{ color: 'white', fontWeight: 700, fontSize: 17, margin: 0 }}>
            Scan QR Code
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>
            Arahkan kamera ke layar admin
          </p>
        </div>
        <button className="qrs-close-btn" onClick={handleClose} aria-label="Tutup scanner">
          <X size={18} />
        </button>
      </div>

      {/* ── Viewfinder ───────────────────────────────────────────────────── */}
      <div className="qrs-viewfinder-box">

        {/* Video element — web only */}
        {!isNative && (
          <video
            ref={videoRef}
            className="qrs-video"
            playsInline
            muted
            autoPlay
          />
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Scan frame corners — selalu tampil saat scanning */}
        {scanState === 'scanning' && (
          <>
            {!isNative && <div className="qrs-dim" />}
            <span className="qrs-corner qrs-corner--tl" />
            <span className="qrs-corner qrs-corner--tr" />
            <span className="qrs-corner qrs-corner--bl" />
            <span className="qrs-corner qrs-corner--br" />
            <div className="qrs-laser" />
          </>
        )}

        {/* ── State overlays ─────────────────────────────────────────────── */}

        {scanState === 'verifying' && (
          <div className="qrs-state-overlay">
            <RefreshCw size={32} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, margin: 0 }}>
              MEMVERIFIKASI...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {scanState === 'success' && (
          <div className="qrs-state-overlay">
            <CheckCircle size={48} color="#34d399" />
            <p style={{ color: '#34d399', fontWeight: 700, fontSize: 15, margin: 0 }}>
              BERHASIL!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>
              {successMessage}
            </p>
          </div>
        )}

        {scanState === 'error' && (
          <div className="qrs-state-overlay">
            <AlertTriangle size={40} color="#f87171" />
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 13, margin: '0 0 4px', textAlign: 'center' }}>
              {cameraError ? 'KAMERA ERROR' : 'GAGAL VERIFIKASI'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0, textAlign: 'center', maxWidth: 200, lineHeight: 1.5 }}>
              {errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="qrs-footer">
        {scanState === 'error' && (
          <button className="qrs-retry-btn" onClick={handleRetry}>
            <RefreshCw size={15} />
            Coba Lagi
          </button>
        )}
        {scanState === 'scanning' && (
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>
            Pastikan QR Code terlihat jelas di dalam frame
          </p>
        )}
      </div>
    </div>,
    document.body, // ← Portal target: langsung ke body, di luar #root
  );
}
