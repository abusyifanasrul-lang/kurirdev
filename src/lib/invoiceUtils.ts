import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { Order } from '@/types';
import { getPlatformInfo, isMobile } from './platformUtils';

/**
 * Utility to share invoice as PNG image.
 * Designed to work on Web (Navigator Share / Download) and Native (Capacitor Share).
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
  const platform = getPlatformInfo();

  if (!element) {
    addToast('Gagal: Elemen invoice tidak ditemukan.', 'error');
    return;
  }

  const toastId = addToast('Langkah 1/4: Menyiapkan Gambar...', 'loading', 0);

  try {
    // 1. Capture as PNG
    console.log('[InvoiceNative] Capturing element...');
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    if (platform.isNative) {
      // 2. NATIVE APK FLOW
      console.log('[InvoiceNative] Native flow...');
      updateToast(toastId, { message: 'Langkah 2/4: Memeriksa Izin Storage...' });
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
      }

      updateToast(toastId, { message: 'Langkah 3/4: Menyimpan ke Cache...' });
      const fileName = `Invoice-${order.order_number}-${Date.now()}.png`;
      const base64Data = dataUrl.split(',')[1];
      
      const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
      });

      updateToast(toastId, { message: 'Langkah 4/4: Membuka Menu Share...' });
      await Share.share({
          title: `Invoice ${order.order_number}`,
          text: `Bukti pengiriman pesanan #${order.order_number} untuk ${order.customer_name}`,
          url: writeResult.uri,
          dialogTitle: 'Kirim Invoice'
      });
      
      removeToast(toastId);
      addToast('Invoice siap dibagikan!', 'success', 2000);
    } else {
      // 2. WEB / PWA FLOW
      const canShare = !!navigator.share && isMobile();
      
      if (canShare) {
        try {
          updateToast(toastId, { message: 'Langkah 2/3: Menyiapkan File Share...' });
          
          // Convert dataUrl to File object for navigator.share
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `Invoice-${order.order_number}.png`, { type: 'image/png' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            updateToast(toastId, { message: 'Langkah 3/3: Membuka Menu Share...' });
            await navigator.share({
              files: [file],
              title: `Invoice ${order.order_number}`,
              text: `Bukti pengiriman pesanan #${order.order_number}`
            });
            removeToast(toastId);
            addToast('Invoice siap dibagikan!', 'success', 2000);
            return;
          }
        } catch (shareErr) {
          console.warn('[InvoiceNative] Navigator share failed, falling back to download', shareErr);
        }
      }

      // 3. DOWNLOAD FALLBACK (Standard Web or failed Share)
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
  }
}

/**
 * Direct WhatsApp Text Share
 */
export function shareToWhatsApp(order: Order) {
  if (!order.customer_phone) return;
  
  const cleanPhone = order.customer_phone.replace(/\D/g, '');
  const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
  
  const items = order.items || [];
  const itemTotal = items.reduce((sum: number, item: any) => sum + (item.harga || 0), 0) || (order.item_price ?? 0);
  const totalPaid = (order.total_fee || 0) + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0) + itemTotal;

  const text = `Halo Kak ${order.customer_name},\n\nTerima kasih telah menggunakan jasa kami. Berikut rincian pesanan #${order.order_number}:\n\nTotal Pembayaran: Rp ${totalPaid.toLocaleString('id-ID')}\nStatus: LUNAS\n\nKurir: ${order.courier_name || 'Kurir'}\n\nTerima kasih! 🙏`;
  
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

