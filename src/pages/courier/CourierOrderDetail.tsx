import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Navigation, CheckCircle, Package, Truck, Plus, X, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/utils/cn';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { OrderStatus } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';
import html2canvas from 'html2canvas';

export function CourierOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, updateOrderStatus, cancelOrder, updateBiayaTambahan, updateItemBarang, updateOngkir } = useOrderStore();
  const { user } = useAuth();
  const { couriers } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;
  const currentCourier = useMemo(() => couriers.find(c => c.id === user?.id), [couriers, user]);
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };
  const commissionRate = currentCourier?.commission_rate ?? commission_rate;

  const order = useMemo(() => orders.find(o => o.id === id), [orders, id]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelStep, setCancelStep] = useState(0); // 0=idle, 1=confirm
  const [cancelTimer, setCancelTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showBebanForm, setShowBebanForm] = useState(false);
  const [namaBeban, setNamaBeban] = useState('');
  const [biayaBeban, setBiayaBeban] = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [namaItem, setNamaItem] = useState('');
  const [hargaItem, setHargaItem] = useState('');
  const [editOngkir, setEditOngkir] = useState(false);
  const [ongkirValue, setOngkirValue] = useState('');

  useEffect(() => {
    if (order) {
      setNamaItem(order.item_name || '');
      setHargaItem(order.item_price ? String(order.item_price) : '');
      setOngkirValue(String(order.total_fee || 0));
    }
  }, [order]);

  if (!order) return <div className="p-8 text-center">Order not found</div>;

  const titik = order.titik ?? 0;
  const beban = order.beban ?? [];
  const totalBiayaTitik = order.total_biaya_titik ?? 0;
  const totalBiayaBeban = order.total_biaya_beban ?? 0;
  const totalTagihanCustomer = (order.total_fee || 0) + totalBiayaTitik + totalBiayaBeban;

  const statusFlow: OrderStatus[] = ['assigned', 'picked_up', 'in_transit', 'delivered'];
  const currentStepIndex = statusFlow.indexOf(order.status);

  const getNextStatus = (): OrderStatus | null => {
    const idx = statusFlow.indexOf(order.status);
    return idx !== -1 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const getNextStatusButton = () => {
    switch (getNextStatus()) {
      case 'picked_up': return { label: 'Pick Up Order', color: 'bg-green-600 hover:bg-green-700' };
      case 'in_transit': return { label: 'Mulai Antar', color: 'bg-green-600 hover:bg-green-700' };
      case 'delivered': return { label: 'Tandai Terkirim', color: 'bg-green-600 hover:bg-green-700' };
      default: return null;
    }
  };

  const handleUpdateStatus = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;
    setIsUpdating(true);
    await new Promise(r => setTimeout(r, 800));
    updateOrderStatus(order.id, nextStatus, user?.id || '', user?.name || 'Kurir');
    setIsUpdating(false);
    // Tidak auto-navigate, biarkan kurir tap tombol invoice dulu;
  };

  const handleTambahTitik = async () => {
    const newTitik = titik + 1;
    await updateBiayaTambahan(order.id, newTitik, beban);
  };

  const handleHapusTitik = async () => {
    if (titik <= 0) return;
    await updateBiayaTambahan(order.id, titik - 1, beban);
  };

  const handleTambahBeban = async () => {
    if (!namaBeban || !biayaBeban) return;
    const newBeban = [...beban, { nama: namaBeban, biaya: Number(biayaBeban) }];
    await updateBiayaTambahan(order.id, titik, newBeban);
    setNamaBeban('');
    setBiayaBeban('');
    setShowBebanForm(false);
  };

  const handleHapusBeban = async (index: number) => {
    const newBeban = beban.filter((_, i) => i !== index);
    await updateBiayaTambahan(order.id, titik, newBeban);
  };

  const handleSimpanItem = async () => {
    if (!namaItem || !hargaItem) return;
    await updateItemBarang(order.id, namaItem, Number(hargaItem));
    setShowItemForm(false);
  };

  const handleSimpanOngkir = async () => {
    const val = Number(ongkirValue);
    if (!val || val <= 0) return;
    await updateOngkir(order.id, val);
    setEditOngkir(false);
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

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    await cancelOrder(order.id, cancelReason, user?.id || '', user?.name || 'Kurir');
    setShowCancelModal(false);
    navigate('/courier/orders');
  };

  const handleBagikanInvoice = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Invoice-${order.order_number}.png`;
    link.href = dataUrl;
    link.click();
  };

  const statusSteps = [
    { status: 'assigned', label: 'Assigned', icon: Package },
    { status: 'picked_up', label: 'Picked Up', icon: CheckCircle },
    { status: 'in_transit', label: 'On The Way', icon: Truck },
    { status: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const nextStatusButton = getNextStatusButton();

  if (order.status === 'cancelled') {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center">
          <h1 className="text-red-700 font-bold text-lg">Order Dibatalkan</h1>
          <p className="text-red-600 mt-2">{order.cancellation_reason || 'Order ini telah dibatalkan.'}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm font-medium underline">Kembali</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 -mx-4 -mt-6 pb-8">

      {/* Header compact */}
      <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/80 hover:text-white text-sm">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <span className="font-bold text-sm">{order.order_number}</span>
        <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">
          {order.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      <div className="px-4 space-y-3">

        {/* Customer Info compact */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                {order.customer_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{order.customer_name}</p>
                <p className="text-xs text-gray-500">{order.customer_phone}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const phone = order.customer_phone.startsWith('0')
                  ? '62' + order.customer_phone.slice(1)
                  : order.customer_phone.replace('+', '');
                window.open(`https://wa.me/${phone}`, '_blank');
              }}
              className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 flex-1">{order.customer_address}</p>
          </div>
          <button
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium"
          >
            <Navigation className="h-4 w-4" /> Buka di Maps
          </button>
        </div>

        {/* Nama Barang */}
        {(order.item_name || order.item_price) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 mb-1">Nama Barang</p>
            <p className="text-sm font-bold text-gray-900">{order.item_name || '-'}</p>
            {(order.item_price ?? 0) > 0 && (
              <p className="text-sm font-semibold text-amber-700 mt-0.5">Rp {(order.item_price ?? 0).toLocaleString('id-ID')}</p>
            )}
            <p className="text-[10px] text-amber-600 mt-1">* Tidak termasuk dalam total ongkir</p>
          </div>
        )}

        {/* Order Details + Titik & Beban */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Rincian Order</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ongkir</span>
              <span className="font-medium">Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pendapatanmu ({commissionRate}%)</span>
              <span className="font-medium text-green-600">Rp {calcCourierEarning(order, { commission_rate: commissionRate, commission_threshold }).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Waktu Order</span>
              <span className="text-gray-700">{order.created_at ? format(parseISO(order.created_at), 'dd MMM, HH:mm') : '-'}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-3">

            {/* Nama Barang / Keterangan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama Barang / Keterangan</p>
                {order.status !== 'delivered' && (
                  <button
                    onClick={() => { setShowItemForm(!showItemForm); setNamaItem(order.item_name || ''); setHargaItem(order.item_price ? String(order.item_price) : ''); }}
                    className="text-xs text-indigo-600 font-medium hover:underline"
                  >
                    {order.item_name ? 'Edit' : '+ Tambah'}
                  </button>
                )}
              </div>

              {order.item_name ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-bold text-gray-900">{order.item_name}</p>
                  <p className="text-sm font-semibold text-yellow-700 mt-0.5">
                    Rp {(order.item_price || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">* Tidak termasuk dalam total ongkir</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Belum ada keterangan barang</p>
              )}

              {showItemForm && order.status !== 'delivered' && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Nama barang (cth: susu beruang 2 kaleng)"
                    value={namaItem}
                    onChange={e => setNamaItem(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    type="number"
                    placeholder="Harga aktual (cth: 24000)"
                    value={hargaItem}
                    onChange={e => setHargaItem(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowItemForm(false)} className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">Batal</button>
                    <button onClick={handleSimpanItem} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium">Simpan</button>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Ongkir */}
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ongkir</p>
                {order.status !== 'delivered' && (
                  <button
                    onClick={() => { setEditOngkir(!editOngkir); setOngkirValue(String(order.total_fee || 0)); }}
                    className="text-xs text-indigo-600 font-medium hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editOngkir ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={ongkirValue}
                    onChange={e => setOngkirValue(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button onClick={() => setEditOngkir(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">Batal</button>
                  <button onClick={handleSimpanOngkir} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium">Simpan</button>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-900">Rp {(order.total_fee || 0).toLocaleString('id-ID')}</p>
              )}
            </div>

            {/* Titik Tambahan */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Titik Tambahan</span>
                <div className="flex items-center gap-2">
                  {titik > 0 && (
                    <button onClick={handleHapusTitik} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg font-bold">−</button>
                  )}
                  {titik > 0 && <span className="text-sm font-semibold w-4 text-center">{titik}</span>}
                  <button onClick={handleTambahTitik} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                    <Plus className="h-3.5 w-3.5" /> Titik
                  </button>
                </div>
              </div>
              {titik > 0 && (
                <div className="text-xs text-gray-500 flex justify-between bg-gray-50 px-3 py-1.5 rounded-lg">
                  <span>{titik} titik × Rp 3.000</span>
                  <span className="font-medium text-gray-700">Rp {totalBiayaTitik.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Beban Tambahan */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Beban Tambahan</span>
                <button onClick={() => setShowBebanForm(true)} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                  <Plus className="h-3.5 w-3.5" /> Beban
                </button>
              </div>
              {beban.length > 0 && (
                <div className="space-y-1">
                  {beban.map((b, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg text-xs">
                      <span className="text-gray-600">{b.nama}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Rp {b.biaya.toLocaleString('id-ID')}</span>
                        <button onClick={() => handleHapusBeban(i)} className="text-gray-400 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showBebanForm && (
                <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Nama beban (misal: Antri)"
                    value={namaBeban}
                    onChange={e => setNamaBeban(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    type="number"
                    placeholder="Biaya (Rp)"
                    value={biayaBeban}
                    onChange={e => setBiayaBeban(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowBebanForm(false); setNamaBeban(''); setBiayaBeban(''); }} className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600">Batal</button>
                    <button onClick={handleTambahBeban} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium">Simpan</button>
                  </div>
                </div>
              )}
            </div>

            {/* Total Tagihan Customer */}
            {(titik > 0 || beban.length > 0) && (
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Total Tagihan Customer</span>
                <span className="text-gray-900">Rp {totalTagihanCustomer.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline + Action */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">

          {/* Timeline slim */}
          <div className="flex items-center justify-between mb-4">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      isCompleted ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
                    )}>
                      {index < currentStepIndex ? "✓" : index + 1}
                    </div>
                    <p className={cn("text-[10px] mt-1 text-center leading-tight", isCompleted ? "text-green-600 font-medium" : "text-gray-400")}>
                      {step.label}
                    </p>
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-1 mb-4", index < currentStepIndex ? "bg-green-600" : "bg-gray-200")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          {isSuspended ? (
            <div className="w-full py-3 px-4 rounded-xl bg-red-50 border border-red-200 text-center">
              <p className="text-red-600 font-medium text-sm">Akun Anda sedang disuspend.</p>
            </div>
          ) : order.status === 'delivered' ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="font-semibold text-green-800 text-sm">✅ Order Terkirim!</p>
              </div>
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                📸 Bagikan Invoice ke Customer
              </button>
            </div>
          ) : (
            nextStatusButton && (
              <button
                onClick={handleUpdateStatus}
                disabled={isUpdating}
                className={cn("w-full py-3 rounded-xl font-semibold text-white transition-all", nextStatusButton.color, isUpdating && "opacity-70 cursor-not-allowed")}
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memperbarui...
                  </span>
                ) : nextStatusButton.label}
              </button>
            )
          )}
        </div>

        {/* Tombol Cancel — jauh di bawah */}
        {order.status !== 'delivered' && !isSuspended && (
          <button
            onClick={handleCancelTap}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium border transition-all mt-4",
              cancelStep === 1
                ? "bg-red-600 text-white border-red-600 animate-pulse"
                : "bg-white text-red-500 border-red-200 hover:bg-red-50"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {cancelStep === 1 ? "Yakin? Tap lagi untuk konfirmasi" : "Laporkan Cancel ke Admin"}
            </span>
          </button>
        )}
      </div>

      {/* Modal Cancel */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900">Alasan Cancel</h3>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Jelaskan alasan cancel order ini..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              rows={3}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Batal</button>
              <button onClick={handleConfirmCancel} disabled={!cancelReason.trim()} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Konfirmasi Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice tersembunyi untuk di-capture */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0' }}>
        <div ref={invoiceRef} style={{ background: '#ffffff', padding: '24px', width: '320px', fontFamily: 'sans-serif', fontSize: '12px', color: '#111827' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4338ca' }}>🛵 KurirDev</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Invoice Pengiriman</div>
          </div>
          <div style={{ marginBottom: '12px', lineHeight: '1.6' }}>
            <div><span style={{ fontWeight: '600' }}>No. Order</span> : {order.order_number}</div>
            <div><span style={{ fontWeight: '600' }}>Tanggal</span> : {format(parseISO(order.created_at), 'dd MMM yyyy, HH:mm')}</div>
            <div><span style={{ fontWeight: '600' }}>Kurir</span> : {user?.name}</div>
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '10px 0', marginBottom: '12px', lineHeight: '1.6' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>PENERIMA</div>
            <div>{order.customer_name}</div>
            <div style={{ color: '#6b7280' }}>{order.customer_address}</div>
            <div style={{ color: '#6b7280' }}>{order.customer_phone}</div>
          </div>
          {order.item_name && (
            <div style={{ margin: '12px 0', padding: '10px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#854d0e', textTransform: 'uppercase', marginBottom: '4px' }}>
                Nama Barang / Keterangan
              </p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917' }}>{order.item_name}</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#a16207' }}>Rp {(order.item_price || 0).toLocaleString('id-ID')}</p>
              <p style={{ fontSize: '9px', color: '#a16207', marginTop: '3px' }}>* Tidak termasuk dalam total ongkir</p>
            </div>
          )}
          <div style={{ marginBottom: '12px', lineHeight: '1.8' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>RINCIAN BIAYA</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Ongkir</span>
              <span>Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
            </div>
            {titik > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontWeight: '500', marginTop: '6px' }}>Titik Tambahan</div>
                {Array.from({ length: titik }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                    <span style={{ color: '#9ca3af' }}>• Titik {i + 1}</span>
                    <span>Rp 3.000</span>
                  </div>
                ))}
              </div>
            )}
            {beban.length > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontWeight: '500', marginTop: '6px' }}>Beban Tambahan</div>
                {beban.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                    <span style={{ color: '#9ca3af' }}>• {b.nama}</span>
                    <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: '2px solid #111827', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
            <span>TOTAL ONGKIR</span>
            <span>Rp {totalTagihanCustomer.toLocaleString('id-ID')}</span>
          </div>
          {(order.item_price ?? 0) > 0 && (
            <div style={{ borderTop: '1px dashed #d97706', paddingTop: '8px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#854d0e' }}>
              <span>TOTAL DIBAYAR CUSTOMER</span>
              <span>Rp {(totalTagihanCustomer + (order.item_price ?? 0)).toLocaleString('id-ID')}</span>
            </div>
          )}
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>
            Terima kasih telah menggunakan layanan KurirDev 🙏
          </div>
        </div>
      </div>
    </div>
  );
}
