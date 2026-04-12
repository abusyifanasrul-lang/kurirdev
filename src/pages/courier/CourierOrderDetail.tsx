import { useState, useRef, useEffect, useMemo } from 'react';
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
import { InvoiceTemplate } from '@/components/orders/InvoiceTemplate';

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
  const { 
    findByPhone, 
    upsertCustomer, 
    createAddressChangeRequest, 
    fetchPendingRequests,
    subscribeToRequests,
    subscribeToCustomers
  } = useCustomerStore();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const customerSectionRef = useRef<HTMLDivElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);

  // Stabilize order reference with useMemo to prevent TDZ issues in minified builds
  const order = useMemo(() => {
     return (currentOrder?.id === id ? currentOrder : null)
       || activeOrdersByCourier.find(o => o.id === id)
       || null;
  }, [currentOrder, activeOrdersByCourier, id]);

  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  useEffect(() => {
    if (!id) return;
    const unsubOrder = subscribeOrderById(id);
    const unsubRequests = subscribeToRequests();
    const unsubCustomers = subscribeToCustomers();
    
    fetchPendingRequests();
    
    return () => {
      unsubOrder();
      unsubRequests();
      unsubCustomers();
    };
  }, [id, subscribeOrderById, subscribeToRequests, subscribeToCustomers, fetchPendingRequests]);

  // Auto-scroll to show success view when delivered - use separate ref to avoid repetitive scrolls
  const hasScrolled = useRef(false);
  useEffect(() => {
    if (order?.status === 'delivered' && !hasScrolled.current) {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 300);
      hasScrolled.current = true;
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

  const isLocked = order?.status === 'delivered' || order?.status === 'cancelled' || isSuspended;

  useEffect(() => {
    if (order && !showItemForm) {
      if (order.items) setItemList(order.items);
      if (order.total_fee) setOngkirValue(formatRupiah(String(order.total_fee)));
      // Reset input form saat form ditutup
      setNamaItem('');
      setHargaItem('');
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

  // Auto-scroll logic for Customer Info
  const wasEditingCustomer = useRef(false);
  useEffect(() => {
    if (wasEditingCustomer.current && !editCustomer) {
      setTimeout(() => {
        customerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    wasEditingCustomer.current = editCustomer;
  }, [editCustomer]);

  // Auto-scroll logic for Items List
  const wasEditingItems = useRef(false);
  useEffect(() => {
    if (wasEditingItems.current && !showItemForm) {
      setTimeout(() => {
        itemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    wasEditingItems.current = showItemForm;
  }, [showItemForm]);

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
      case 'picked_up': return { label: 'GAS 🛵 Menuju Penjual', color: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'in_transit': return { label: 'GAS 🛵 Menuju Customer', color: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'delivered': return { label: 'CEKLIS ✅ Tandai Terkirim', color: 'bg-emerald-600 hover:bg-emerald-700' };
      default: return null;
    }
  };

  const handleUpdateStatus = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;
    setIsUpdating(true);
    
    const toastStore = useToastStore.getState();
    let loadingToastId: string | undefined;
    
    if (nextStatus === 'delivered') {
      loadingToastId = toastStore.addToast('Menyelesaikan pesanan...', 'loading', 0);
    }

    try {
      await new Promise(r => setTimeout(r, 800));
      await updateOrderStatus(order.id, nextStatus, user?.id || '', user?.name || 'Kurir');
      
      if (nextStatus === 'delivered') {
        toastStore.addToast('Pesanan Berhasil Diselesaikan!', 'success', 3000);
      }
      
      if (nextStatus === 'picked_up') {
        setShowWaReminder(true);
        setTimeout(() => setShowWaReminder(false), 6000);
      }
    } finally {
      setIsUpdating(false);
      if (loadingToastId) {
        toastStore.removeToast(loadingToastId);
      }
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
    const val = Number(ongkirValue.replace(/\D/g, ''));
    if (isNaN(val) || val < 0) return;
    await updateOngkir(order.id, val);
    setEditOngkir(false);
  };

  const handleTambahItem = () => {
    if (!namaItem || !hargaItem) return;
    setItemList([...itemList, { nama: namaItem, harga: Number(hargaItem.replace(/\D/g, '')) }]);
    setNamaItem('');
    setHargaItem('');
  };

  const handleHapusItem = (index: number) => {
    const newList = itemList.filter((_, i) => i !== index);
    setItemList(newList);
  };

  const handleSimpanItems = async () => {
    let finalItems = [...itemList];
    
    // Otomatis tambahkan item yang sedang diketik jika valid
    const cleanHarga = Number(hargaItem.replace(/\D/g, ''));
    if (namaItem.trim() && !isNaN(cleanHarga) && cleanHarga > 0) {
      finalItems = [...finalItems, { 
        nama: namaItem.trim(), 
        harga: cleanHarga 
      }];
    }

    await updateItems(order.id, finalItems);
    
    // Pastikan form dibersihkan dan ditutup
    setNamaItem('');
    setHargaItem('');
    setShowItemForm(false);
  };

  const handleSimpanCustomer = async () => {
    if (!editName || !editPhone || !editAddress || !order) return;
    
    const existing = findByPhone(editPhone);

    // Update dokumen order langsung untuk kelancaran pengantaran courier
    await updateOrder(order.id, {
      customer_name: editName,
      customer_phone: editPhone,
      customer_address: editAddress
    });

    if (existing) {
      const addrExists = existing.addresses.find(a => a.address.toLowerCase() === editAddress.toLowerCase());
      if (!addrExists) {
        // Alamat baru tidak dikenali, ajukan perubahan ke admin
        const newAddr = {
          id: crypto.randomUUID(),
          label: `Koreksi Kurir ${existing.addresses.length + 1}`,
          address: editAddress,
          is_default: existing.addresses.length === 0,
          notes: ''
        };
        await createAddressChangeRequest(
          existing.id,
          'address_add',
          existing,
          { ...existing, addresses: [...existing.addresses, newAddr] },
          order.id,
          user?.id,
          user?.name,
          newAddr
        );
      }
    } else {
      // Customer baru beneran
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
      console.log('📄 Bagikan Invoice triggered', { 
        orderId: order?.id, 
        hasRef: !!invoiceRef.current,
        status: order?.status 
      });
      
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

      <div className={cn(
        "transition-all duration-300",
        order.status === 'delivered' ? "pb-0" : "pb-10"
      )}>
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

          <div ref={customerSectionRef}>
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
               if (cust) {
                  const updatedAddresses = cust.addresses.map(a => a.id === id ? { ...a, address: addr } : a);
                  await createAddressChangeRequest(cust.id, 'address_edit', cust, { ...cust, addresses: updatedAddresses }, order.id, user?.id, user?.name, undefined, id);
                  useToastStore.getState().addToast('Perubahan diajukan ke admin', 'success');
               }
            }}
            onDeleteAddress={async (id) => {
               const cust = findByPhone(order.customer_phone || '');
               if (cust) {
                  const updatedAddresses = cust.addresses.filter(a => a.id !== id);
                  await createAddressChangeRequest(cust.id, 'address_delete', cust, { ...cust, addresses: updatedAddresses }, order.id, user?.id, user?.name, undefined, id);
                  useToastStore.getState().addToast('Penghapusan diajukan ke admin', 'success');
               }
            }}
            onAddNewAddress={async (phone, addr) => {
               const cust = findByPhone(phone);
               if (cust) {
                  const newAddr = { id: crypto.randomUUID(), label: 'Ditambah Kurir', address: addr, is_default: false, notes: '' };
                  await createAddressChangeRequest(cust.id, 'address_add', cust, { ...cust, addresses: [...cust.addresses, newAddr] }, order.id, user?.id, user?.name, newAddr);
                  useToastStore.getState().addToast('Penambahan diajukan ke admin', 'success');
               }
            }}
            onSetAppliedAddress={async (addr) => {
               setEditAddress(addr);
               await updateOrder(order.id, { customer_address: addr });
               useToastStore.getState().addToast('Alamat diterapkan pada order ini', 'success');
            }}
          />
          </div>

          <div ref={itemsSectionRef}>
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
            formatRupiah={formatRupiah}
          />
          </div>

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

          {/* Centrally managed Invoice Template */}
          <InvoiceTemplate order={order} invoiceRef={invoiceRef} />

          {/* Completion Success View */}
          {order.status === 'delivered' && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] p-8 text-center shadow-xl shadow-emerald-900/5">
                <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                  <span className="text-4xl animate-bounce">✅</span>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900">Pesanan Berhasil Terkirim!</h2>
                <p className="text-sm text-gray-500 mb-8 max-w-[240px] mx-auto">Saldo Anda telah diperbarui sesuai komisi pesanan ini.</p>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleBagikanInvoice}
                    disabled={isGeneratingInvoice}
                    className="flex items-center justify-center gap-3 w-full p-5 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 border-b-4 border-emerald-800"
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
