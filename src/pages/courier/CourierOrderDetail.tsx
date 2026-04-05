import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Navigation } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { OrderStatus } from '@/types';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useToastStore } from '@/stores/useToastStore';
import { removeFromLocalDB } from '@/lib/orderCache';

// Sub-components
import { OrderHeader } from './components/order-detail/OrderHeader';
import { OrderCustomerInfo } from './components/order-detail/OrderCustomerInfo';
import { OrderItemsList } from './components/order-detail/OrderItemsList';
import { OrderPricingSummary } from './components/order-detail/OrderPricingSummary';
import { OrderCancelModal } from './components/order-detail/OrderCancelModal';

// Format angka ke tampilan Rupiah: 20000 → "Rp 20.000"
const formatRupiah = (val: string): string => {
  const angka = val.replace(/\D/g, '');
  if (!angka) return '';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
};

export function CourierOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrdersByCourier, currentOrder, subscribeOrderById, updateOrderStatus, cancelOrder, updateBiayaTambahan, updateItems, updateOngkir, updateOrderWaiting, updateOrder } = useOrderStore();
  const { user } = useAuth();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;
  const { findByPhone, addAddress, updateAddress: updateCustomerAddress, deleteAddress: deleteCustomerAddress, upsertCustomer } = useCustomerStore();

  const order = (currentOrder?.id === id ? currentOrder : null)
    || activeOrdersByCourier.find(o => o.id === id)
    || null;

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeOrderById(id);
    return () => unsub();
  }, [id]);

  // Auto-scroll to show success view when delivered
  useEffect(() => {
    if (order?.status === 'delivered') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [order?.status]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [showWaReminder, setShowWaReminder] = useState(false);
  const [isWaitingUpdating, setIsWaitingUpdating] = useState(false);
  const [cancelStep, setCancelStep] = useState(0); 
  const [cancelTimer, setCancelTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonType, setCancelReasonType] = useState<'customer' | 'item_unavailable' | 'other' | ''>('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [showBebanForm, setShowBebanForm] = useState(false);
  const [namaBeban, setNamaBeban] = useState('');
  const [biayaBeban, setBiayaBeban] = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemList, setItemList] = useState<{ nama: string; harga: number }[]>([]);
  const [namaItem, setNamaItem] = useState('');
  const [hargaItem, setHargaItem] = useState('');
  const [editOngkir, setEditOngkir] = useState(false);
  const [ongkirValue, setOngkirValue] = useState('');
  const [editCustomer, setEditCustomer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Inline address picker state
  const [courierAddrCustomer, setCourierAddrCustomer] = useState<any>(undefined);
  const [courierInlineEditId, setCourierInlineEditId] = useState<string | null>(null);
  const [courierInlineEditValue, setCourierInlineEditValue] = useState('');
  const [courierInlineAddingNew, setCourierInlineAddingNew] = useState(false);
  const [courierInlineNewValue, setCourierInlineNewValue] = useState('');

  const isLocked = order?.status === 'delivered' || isSuspended;

  useEffect(() => {
    if (order && !showItemForm) {
      setItemList(order.items || []);
      setOngkirValue(String(order.total_fee || 0));
    }
    if (order && !editCustomer) {
      setEditName(order.customer_name || '');
      setEditPhone(order.customer_phone || '');
      setEditAddress(order.customer_address || '');
      const found = findByPhone(order.customer_phone || '');
      setCourierAddrCustomer(found);
      setCourierInlineEditId(null);
      setCourierInlineAddingNew(false);
    }
  }, [order, showItemForm, editCustomer]);

  if (!order) return <div className="p-8 text-center bg-white min-h-screen pt-20">Order not found</div>;

  const titik = order.titik ?? 0;
  const beban = order.beban ?? [];
  const totalBiayaTitik = order.total_biaya_titik ?? 0;
  const totalBiayaBeban = order.total_biaya_beban ?? 0;
  const totalOngkir = (order.total_fee || 0) + totalBiayaTitik + totalBiayaBeban;
  const waLink = `https://wa.me/62${order.customer_phone?.replace(/^0/, '')}`;

  const statusFlow: OrderStatus[] = ['assigned', 'picked_up', 'in_transit', 'delivered'];

  const getNextStatus = (): OrderStatus | null => {
    const idx = statusFlow.indexOf(order.status);
    return idx !== -1 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const getNextStatusButton = () => {
    switch (getNextStatus()) {
      case 'picked_up': return { label: 'GAS 🛵 Menuju Penjual', color: 'bg-green-600 hover:bg-green-700' };
      case 'in_transit': return { label: 'GAS 🛵 Menuju Customer', color: 'bg-green-600 hover:bg-green-700' };
      case 'delivered': return { label: 'CEKLIS ✅ Tandai Terkirim', color: 'bg-green-600 hover:bg-green-700' };
      default: return null;
    }
  };

  const handleUpdateStatus = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;
    setIsUpdating(true);
    
    const toast = useToastStore.getState().addToast;
    if (nextStatus === 'delivered') {
      toast('Menyelesaikan pesanan...', 'loading', 2000);
    }

    await new Promise(r => setTimeout(r, 800));
    await updateOrderStatus(order.id, nextStatus, user?.id || '', user?.name || 'Kurir');
    
    setIsUpdating(false);
    
    if (nextStatus === 'delivered') {
      toast('Pesanan Berhasil Diselesaikan!', 'success', 3000);
    }
    
    if (nextStatus === 'picked_up') {
      setShowWaReminder(true);
      setTimeout(() => setShowWaReminder(false), 6000);
    }
  };

  const handleTambahTitik = async () => {
    await updateBiayaTambahan(order.id, titik + 1, beban);
  };

  const handleHapusTitik = async () => {
    if (titik <= 0) return;
    await updateBiayaTambahan(order.id, titik - 1, beban);
  };

  const handleTambahBeban = async () => {
    if (!namaBeban || !biayaBeban) return;
    const cleanBiaya = biayaBeban.replace(/\D/g, '');
    const newBeban = [...beban, { nama: namaBeban, biaya: Number(cleanBiaya) }];
    await updateBiayaTambahan(order.id, titik, newBeban);
    setNamaBeban('');
    setBiayaBeban('');
    setShowBebanForm(false);
  };

  const handleHapusBeban = async (index: number) => {
    const newBeban = beban.filter((_, i) => i !== index);
    await updateBiayaTambahan(order.id, titik, newBeban);
  };

  const handleSimpanOngkir = async () => {
    const val = Number(ongkirValue);
    if (isNaN(val) || val < 0) return;
    await updateOngkir(order.id, val);
    setEditOngkir(false);
  };

  const handleTambahItem = () => {
    if (!namaItem || !hargaItem) return;
    setItemList([...itemList, { nama: namaItem, harga: Number(hargaItem) }]);
    setNamaItem('');
    setHargaItem('');
  };

  const handleHapusItem = (index: number) => {
    const newList = itemList.filter((_, i) => i !== index);
    setItemList(newList);
  };

  const handleSimpanItems = async () => {
    await updateItems(order.id, itemList);
    setShowItemForm(false);
  };

  const handleSimpanCustomer = async () => {
    if (!editName || !editPhone || !editAddress || !order) return;
    
    // Sync ke master customer store
    const existing = findByPhone(editPhone);
    if (existing) {
      const addrExists = existing.addresses.find(a => a.address.toLowerCase() === editAddress.toLowerCase());
      if (!addrExists) {
        await addAddress(existing.id, {
          label: `Koreksi Kurir ${existing.addresses.length + 1}`,
          address: editAddress,
          is_default: existing.addresses.length === 0,
          notes: ''
        });
      }
    } else {
      await upsertCustomer({
        name: editName,
        phone: editPhone,
        addresses: [{
          id: crypto.randomUUID(),
          label: 'Alamat Utama',
          address: editAddress,
          is_default: true,
          notes: ''
        }]
      });
    }

    // Update dokumen order
    await updateOrder(order.id, {
      customer_name: editName,
      customer_phone: editPhone,
      customer_address: editAddress
    });
    setEditCustomer(false);
  };

  const handleCancelTap = () => {
    if (cancelStep === 0) {
      setCancelStep(1);
      const t = setTimeout(() => setCancelStep(0), 3000);
      setCancelTimer(t);
    } else {
      if (cancelTimer) clearTimeout(cancelTimer);
      setCancelStep(0);
      setShowCancelModal(true);
    }
  };

  const handleToggleWaiting = async () => {
    if (isWaitingUpdating) return;
    setIsWaitingUpdating(true);
    const newVal = !(order.is_waiting ?? false);
    await updateOrderWaiting(order.id, newVal);
    setIsWaitingUpdating(false);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReasonType) return;
    const reasonLabel =
      cancelReasonType === 'customer' ? 'Dibatalkan oleh customer' :
      cancelReasonType === 'item_unavailable' ? 'Barang tidak tersedia / habis' :
      'Lainnya';
    const fullReason = cancelReasonText.trim()
      ? `${reasonLabel}: ${cancelReasonText.trim()}` 
      : reasonLabel;
    await cancelOrder(order.id, fullReason, user?.id || '', user?.name || 'Kurir', cancelReasonType);
    await removeFromLocalDB(order.id);
    setShowCancelModal(false);
    navigate('/courier/orders');
  };

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const handleBagikanInvoice = async () => {
    if (!invoiceRef.current || isGeneratingInvoice) return;
    
    const addToast = useToastStore.getState().addToast;
    const removeToast = useToastStore.getState().removeToast;
    let toastId: string | undefined;

    try {
      setIsGeneratingInvoice(true);
      toastId = addToast('Menyiapkan Gambar Invoice...', 'loading', 0);
      
      const { default: html2canvas } = await import('html2canvas');
      
      // Tunggu sebentar untuk memastikan ref ter-render sempurna
      await new Promise(r => setTimeout(r, 300));
      
      const canvas = await html2canvas(invoiceRef.current, { 
        scale: 3, // Lebih tajam untuk printer thermal
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        scrollX: 0,
        scrollY: -window.scrollY, // Fix position fixed issues
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('*').forEach((el) => {
            const s = (el as HTMLElement).style;
            ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'].forEach((prop) => {
              const val = (s as any)[prop];
              if (typeof val === 'string' && val.includes('oklch')) {
                (s as any)[prop] = prop === 'color' ? 'inherit' : 'transparent';
              }
            });
          });
        }
      });
          });
        }
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `Invoice-${order.order_number}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (toastId) removeToast(toastId);
      addToast('Invoice berhasil diunduh!', 'success', 3000);
    } catch (error: any) {
      console.error('Invoice generation failed:', error);
      if (toastId) removeToast(toastId);
      addToast(`Gagal: ${error.message || 'Coba lagi'}`, 'error', 5000);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="sticky top-[72px] z-30">
        <OrderHeader 
          order={order}
          onBagikanInvoice={handleBagikanInvoice}
          isGeneratingInvoice={isGeneratingInvoice}
        />
      </div>

      <div className="pb-56">
        <div className="max-w-md mx-auto p-4 space-y-4 pt-6">
          {isSuspended && (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-5 mb-4 animate-bounce">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 p-3 rounded-2xl">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-red-900 font-black uppercase tracking-tight">Akun Ditangguhkan</p>
                  <p className="text-red-700 text-xs leading-relaxed mt-1">Selesaikan setoran administrasi untuk melanjutkan pengantaran.</p>
                </div>
              </div>
            </div>
          )}

          <OrderCustomerInfo 
            order={order}
            isLocked={isLocked}
            editCustomer={editCustomer}
            setEditCustomer={setEditCustomer}
            editName={editName}
            setEditName={setEditName}
            editPhone={editPhone}
            setEditPhone={setEditPhone}
            editAddress={editAddress}
            setEditAddress={setEditAddress}
            handleSimpanCustomer={handleSimpanCustomer}
            courierAddrCustomer={courierAddrCustomer}
            courierInlineEditId={courierInlineEditId}
            setCourierInlineEditId={setCourierInlineEditId}
            courierInlineEditValue={courierInlineEditValue}
            setCourierInlineEditValue={setCourierInlineEditValue}
            courierInlineAddingNew={courierInlineAddingNew}
            setCourierInlineAddingNew={setCourierInlineAddingNew}
            courierInlineNewValue={courierInlineNewValue}
            setCourierInlineNewValue={setCourierInlineNewValue}
            onUpdateAddress={async (id, addr) => {
               const cust = findByPhone(order.customer_phone || '');
               if (cust) await updateCustomerAddress(cust.id, id, { address: addr });
            }}
            onDeleteAddress={async (id) => {
               const cust = findByPhone(order.customer_phone || '');
               if (cust) await deleteCustomerAddress(cust.id, id);
            }}
            onAddNewAddress={async (phone, addr) => {
               const cust = findByPhone(phone);
               if (cust) await addAddress(cust.id, { label: 'Ditambah Kurir', address: addr, is_default: false, notes: '' });
            }}
            onSetAppliedAddress={(addr) => setEditAddress(addr)}
          />

          <OrderItemsList 
            order={order}
            isLocked={isLocked}
            showItemForm={showItemForm}
            setShowItemForm={setShowItemForm}
            itemList={itemList}
            namaItem={namaItem}
            setNamaItem={setNamaItem}
            hargaItem={hargaItem}
            setHargaItem={setHargaItem}
            handleTambahItem={handleTambahItem}
            handleHapusItem={handleHapusItem}
            handleSimpanItems={handleSimpanItems}
          />

          <OrderPricingSummary 
            order={order}
            isLocked={isLocked}
            titik={titik}
            beban={beban}
            totalBiayaTitik={totalBiayaTitik}
            totalBiayaBeban={totalBiayaBeban}
            totalOngkir={totalOngkir}
            editOngkir={editOngkir}
            setEditOngkir={setEditOngkir}
            ongkirValue={ongkirValue}
            setOngkirValue={setOngkirValue}
            showBebanForm={showBebanForm}
            setShowBebanForm={setShowBebanForm}
            namaBeban={namaBeban}
            setNamaBeban={setNamaBeban}
            biayaBeban={biayaBeban}
            setBiayaBeban={setBiayaBeban}
            handleTambahTitik={handleTambahTitik}
            handleHapusTitik={handleHapusTitik}
            handleTambahBeban={handleTambahBeban}
            handleHapusBeban={handleHapusBeban}
            handleSimpanOngkir={handleSimpanOngkir}
            formatRupiah={formatRupiah}
          />

          {/* In-layout but invisible container for html2canvas consistency */}
          <div className="absolute opacity-0 pointer-events-none appearance-none h-0 overflow-hidden" aria-hidden="true" style={{ top: '-4000px', width: '500px' }}>
            <div ref={invoiceRef} className="p-10 bg-white w-[500px] font-sans" style={{ backgroundColor: '#ffffff' }}>
               <div className="pb-6 mb-6" style={{ borderBottom: '4px solid #059669' }}>
                 <h1 className="text-3xl font-black uppercase italic leading-none" style={{ color: '#059669' }}>KURIRDEV</h1>
                 <div className="flex justify-between items-end mt-4">
                   <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Order ID: <span style={{ color: '#111827' }}>{order.order_number}</span></p>
                   <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Date: <span style={{ color: '#111827' }}>{new Date().toLocaleDateString('id-ID')}</span></p>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-8 mb-8">
                 <div>
                   <p className="text-[10px] font-bold uppercase mb-2" style={{ color: '#059669' }}>Customer:</p>
                   <p className="text-lg font-black" style={{ color: '#111827' }}>{order.customer_name}</p>
                   <p className="text-xs font-medium" style={{ color: '#6b7280' }}>{order.customer_phone}</p>
                 </div>
               </div>

               <div className="mb-8">
                 <p className="text-[10px] font-bold uppercase mb-4 py-1" style={{ color: '#059669', borderBottom: '1px solid #f3f4f6' }}>Order Items:</p>
                 <div className="space-y-3">
                   {order.items?.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: '#f9fafb' }}>
                       <span className="text-sm font-bold" style={{ color: '#1f2937' }}>{item.nama}</span>
                       <span className="text-sm font-black" style={{ color: '#059669' }}>Rp {item.harga.toLocaleString('id-ID')}</span>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="rounded-3xl p-8 shadow-xl" style={{ backgroundColor: '#059669', color: '#ffffff', boxShadow: '0 20px 25px -5px rgba(5, 150, 105, 0.1)' }}>
                 <div className="space-y-3">
                   <div className="flex justify-between text-xs font-bold uppercase tracking-widest" style={{ color: '#d1fae5' }}>
                     <span>Ongkir Layanan</span>
                     <span>Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
                   </div>
                   {titik > 0 && (
                     <div className="flex justify-between text-xs font-bold uppercase tracking-widest" style={{ color: '#d1fae5' }}>
                       <span>Biaya {titik} Titik</span>
                       <span>+ Rp {totalBiayaTitik.toLocaleString('id-ID')}</span>
                     </div>
                   )}
                   {beban.length > 0 && (
                     <div className="flex justify-between text-xs font-bold uppercase tracking-widest" style={{ color: '#d1fae5' }}>
                       <span>Beban Ekstra</span>
                       <span>+ Rp {totalBiayaBeban.toLocaleString('id-ID')}</span>
                     </div>
                   )}
                   <div className="pt-4 mt-4 flex justify-between items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                     <span className="text-sm font-black uppercase tracking-[0.2em]">Total Bayar</span>
                     <span className="text-3xl font-black italic">Rp {totalOngkir.toLocaleString('id-ID')}</span>
                   </div>
                 </div>
               </div>

               <div className="mt-10 text-center">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 italic" style={{ color: '#059669' }}>Terima kasih telah menggunakan jasa KurirDev</p>
                 <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#d1d5db' }}>Powered by Advanced Agentic Coding System</p>
               </div>
            </div>
          </div>
          {/* Completion Success View */}
          {order.status === 'delivered' && (
            <div className="mt-8 mb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] p-8 text-center shadow-xl shadow-emerald-900/5">
                <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                  <span className="text-4xl animate-bounce">✅</span>
                </div>
                <h2 className="text-24 font-black mb-2 text-gray-900">Pesanan Berhasil Terkirim!</h2>
                <p className="text-14 text-gray-500 mb-8 max-w-[240px] mx-auto">Saldo Anda telah diperbarui sesuai komisi pesanan ini.</p>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleBagikanInvoice}
                    disabled={isGeneratingInvoice}
                    className="flex items-center justify-center gap-3 w-full p-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 border-b-4 border-emerald-800"
                  >
                    {isGeneratingInvoice ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="text-2xl">🖨️</span>
                    )}
                    CETAK / UNDUH INVOICE
                  </button>
                  
                  <button
                    onClick={() => navigate('/courier')}
                    className="w-full p-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold active:scale-95 transition-all"
                  >
                    Kembali ke Beranda
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FIXED FOOTER ACTIONS - Now positioned tightly above global navigation */}
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="fixed bottom-[64px] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-2.5 pb-4 space-y-1.5 shadow-[0_-15px_40px_rgba(0,0,0,0.12)] z-30">
          <div className="flex gap-1.5">
            {!isLocked && (
              <button
                onClick={handleCancelTap}
                className={cn(
                  "flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95",
                  cancelStep === 1 
                    ? "bg-red-600 text-white shadow-lg shadow-red-200" 
                    : "bg-gray-50 text-red-600 border border-red-100"
                )}
              >
                {cancelStep === 1 ? 'TAP LAGI UNTUK BATAL' : 'BATALKAN'}
              </button>
            )}

            <button
              onClick={handleToggleWaiting}
              disabled={isWaitingUpdating || isLocked}
              className={cn(
                "flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                order.is_waiting
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-gray-50 text-emerald-600 border border-emerald-100",
                isLocked && "opacity-50 grayscale"
              )}
            >
              {isWaitingUpdating ? (
                <div className="h-4 w-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
              ) : order.is_waiting ? (
                'PENDING ACT'
              ) : (
                'PENDING'
              )}
            </button>
          </div>

          {getNextStatusButton() && !isLocked && (
            <button
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 text-white",
                getNextStatusButton()?.color,
                isUpdating && "opacity-70 scale-95"
              )}
            >
              {isUpdating ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                getNextStatusButton()?.label
              )}
            </button>
          )}
        </div>
      )}

      <OrderCancelModal 
        showCancelModal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        cancelReasonType={cancelReasonType}
        setCancelReasonType={setCancelReasonType}
        cancelReasonText={cancelReasonText}
        setCancelReasonText={setCancelReasonText}
        handleConfirmCancel={handleConfirmCancel}
      />

      {showWaReminder && (
        <div className="fixed bottom-40 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-2xl flex items-center justify-between gap-4 border-4 border-emerald-500">
             <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-2xl flex items-center justify-center">
                   <Navigation className="h-6 w-6 text-white animate-bounce" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase leading-none italic">Sudah Pick-up?</p>
                  <p className="text-[10px] font-medium text-emerald-50 mt-1 opacity-90">Jangan lupa kirimi WA Pelanggan!</p>
                </div>
             </div>
             <a
               href={waLink}
               target="_blank"
               rel="noopener noreferrer"
               className="bg-white text-emerald-600 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all font-black text-xs shrink-0"
             >
                WA
             </a>
          </div>
        </div>
      )}
    </div>
  );
}
