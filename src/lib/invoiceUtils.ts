import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { Order } from '@/types';

/**
 * Utility to share invoice as PNG image.
 * Designed to work on both Web (download) and Native (system share).
 */
export async function shareInvoiceNative(
  order: Order,
  element: HTMLElement | null,
  toastActions: {
    addToast: (msg: string, type: 'info' | 'success' | 'error' | 'warning' | 'loading', duration?: number) => string;
    removeToast: (id: string) => void;
    updateToast: (id: string, updates: any) => void;
  }
) {
  const { addToast, removeToast, updateToast } = toastActions;

  if (!element) {
    addToast('Gagal: Elemen invoice tidak ditemukan.', 'error');
    return;
  }

  const toastId = addToast('Langkah 1/4: Menyiapkan Gambar...', 'loading', 0);

  try {
    // 1. Capture as PNG
    console.log('[InvoiceNative] Capturing element...');
    const dataUrl = await toPng(element, {
      pixelRatio: 2, // Sharp enough for sharing and thermal printers
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    if (Capacitor.isNativePlatform()) {
      // 2. Request Permissions (Safe to call repeatedly, ensures OS is ready)
      console.log('[InvoiceNative] Checking permissions...');
      updateToast(toastId, { message: 'Langkah 2/4: Memeriksa Izin Storage...' });
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
      }

      // 3. Save to Local Cache
      updateToast(toastId, { message: 'Langkah 3/4: Menyimpan ke Cache...' });
      const fileName = `Invoice-${order.order_number}-${Date.now()}.png`;
      const base64Data = dataUrl.split(',')[1];
      
      const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
      });
      console.log('[InvoiceNative] File written:', writeResult.uri);

      // 4. Trigger Native Share
      updateToast(toastId, { message: 'Langkah 4/4: Membuka Menu Share...' });
      await Share.share({
          title: `Invoice ${order.order_number}`,
          text: `Bukti pengiriman pesanan #${order.order_number}`,
          url: writeResult.uri,
          dialogTitle: 'Kirim/Cetak Invoice'
      });
      
      removeToast(toastId);
      addToast('Invoice siap dibagikan!', 'success', 2000);
    } else {
      // WEB Fallback
      updateToast(toastId, { message: 'Langkah 2/2: Mengunduh Gambar...' });
      const link = document.createElement('a');
      link.download = `Invoice-${order.order_number}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      removeToast(toastId);
      addToast('Invoice berhasil diunduh.', 'success', 2000);
    }
  } catch (err: any) {
    console.error('[InvoiceNative] Global error:', err);
    removeToast(toastId);
    addToast(`Gagal: ${err.message || 'Coba lagi'}`, 'error', 5000);
    // Fallback simple alert for debugging critical issues
    alert(`DEBUG PRINT: ${err.message || JSON.stringify(err)}`);
  }
}
