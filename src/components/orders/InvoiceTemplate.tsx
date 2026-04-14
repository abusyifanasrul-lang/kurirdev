import React, { useMemo } from 'react';
import { Order } from '@/types';
import { format } from 'date-fns';
import { useUserStore } from '@/stores/useUserStore';

interface InvoiceTemplateProps {
  order: Order;
  invoiceRef: React.RefObject<HTMLDivElement | null>;
  showPreview?: boolean;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ order, invoiceRef, showPreview = false }) => {
  const { users } = useUserStore();
  
  const items = order.items || [];
  const itemTotal = useMemo(() => {
    return items.reduce((sum: number, item: any) => sum + (item.harga || 0), 0) || (order.item_price ?? 0);
  }, [items, order.item_price]);
  
  const totalPaid = (order.total_fee || 0) + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0) + itemTotal;

  // Robust Name Resolution
  const resolvedAssigner = order.assigner_name || 
    (order.assigned_by ? users.find(u => u.id === order.assigned_by)?.name : null) || 
    order.assigner?.name || 
    'Sistem';

  const resolvedCourier = order.courier_name || 
    (order.courier_id ? users.find(u => u.id === order.courier_id)?.name : null) || 
    order.courier?.name || 
    'TBD';

  const courierObj = order.courier_id ? users.find(u => u.id === order.courier_id) : null;
  const vehiclePlate = courierObj?.plate_number || '-';

  return (
    <div 
      className={!showPreview ? "absolute opacity-0 pointer-events-none appearance-none h-0 overflow-hidden" : ""} 
      aria-hidden={!showPreview} 
      style={!showPreview ? { top: '-4000px', width: '500px' } : {}}
    >
      <div ref={invoiceRef} style={{ background: '#ffffff', boxSizing: 'border-box', padding: '0', width: '400px', fontFamily: '"Inter", system-ui, sans-serif', color: '#111827', margin: '0' }}>
        
        <div style={{ padding: '32px 24px 48px 24px', background: '#185356', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderRadius: '0 0 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <img 
              src="/icons/android/ikonfix.png" 
              style={{ height: '72px', width: 'auto', display: 'block', marginBottom: '-4px' }} 
              alt="Logo" 
            />
            <span style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em', lineHeight: '1', display: 'block', marginBottom: '8px' }}>KurirMe</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: '32px' }}>
            <div style={{ color: '#00B1C3', fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: '1' }}>Invoice</div>
            <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', lineHeight: '1' }}>Bukti Pengiriman</div>
          </div>
        </div>

        {/* Floating Card - Order Num & Status */}
        <div style={{ padding: '0 24px', marginTop: '-28px', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
           <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 8px 30px rgba(12, 130, 141, 0.12)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#0C828D', letterSpacing: '0.05em', marginBottom: '4px', textTransform: 'uppercase' }}>Nomor Pesanan</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#185356', letterSpacing: '-0.02em' }}>#{order.order_number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', background: '#F4FEFF', color: '#00B1C3', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.05em', border: '1px solid #00B1C3', marginBottom: '6px' }}>
                  LUNAS
                </div>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                  {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm') : format(new Date(), 'dd MMM yyyy, HH:mm')}
                </div>
              </div>
           </div>
        </div>

        {/* Body content */}
        <div style={{ padding: '20px 24px 16px 24px', boxSizing: 'border-box' }}>
            
            {/* Informasi Penerima (Clean) */}
             <div style={{ marginBottom: '24px' }}>
               <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ditujukan Kepada</div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                   <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', textTransform: 'capitalize' }}>{order.customer_name}</div>
                   <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '800', lineHeight: '1.2' }}>{order.customer_phone}</div>
                 </div>
                 <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.4', textTransform: 'capitalize' }}>{order.customer_address}</div>
               </div>
             </div>
            {/* RINCIAN PESANAN (Structured) */}
            <div style={{ marginBottom: '24px' }}>
               <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>
                 Rincian Transaksi
               </div>
               
               <div style={{ borderTop: '2px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', padding: '16px 0' }}>
                 {/* Shopping Items Section */}
                 <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>Item Belanja</div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   {items.length > 0 ? (
                     items.map((item: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                           <div style={{ display: 'flex', gap: '12px', flex: 1, paddingRight: '16px' }}>
                              <span style={{ color: '#94a3b8', fontWeight: 'normal', width: '16px' }}>{i + 1}.</span>
                              <span style={{ color: '#334155', fontWeight: 'normal', lineHeight: '1.4', textTransform: 'capitalize' }}>{item.nama}</span>
                           </div>
                           <div style={{ color: '#0f172a', fontWeight: 'normal', fontVariantNumeric: 'tabular-nums' }}>Rp {item.harga.toLocaleString('id-ID')}</div>
                        </div>
                     ))
                   ) : order.item_name ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '12px', flex: 1, paddingRight: '16px' }}>
                           <span style={{ color: '#94a3b8', fontWeight: 'normal', width: '16px' }}>1.</span>
                           <span style={{ color: '#334155', fontWeight: 'normal', lineHeight: '1.4', textTransform: 'capitalize' }}>{order.item_name}</span>
                        </div>
                        {itemTotal > 0 && <span style={{ color: '#0f172a', fontWeight: 'normal', fontVariantNumeric: 'tabular-nums' }}>Rp {itemTotal.toLocaleString('id-ID')}</span>}
                      </div>
                   ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Tidak ada pembelian barang via kurir.</div>
                   )}
                 </div>

                 {/* Divider */}
                 <div style={{ height: '1px', borderTop: '1px dashed #cbd5e1', margin: '16px 0' }}></div>

                 {/* Shipping & Handling Section */}
                 <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>Biaya Layanan & Ongkir</div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#334155', fontWeight: 'normal' }}>Ongkos Kirim Dasar</span>
                      <span style={{ fontWeight: 'normal', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
                   </div>

                   {(order.titik ?? 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#334155', fontWeight: 'normal' }}>Tambahan {order.titik} Titik Alamat</span>
                        <span style={{ fontWeight: 'normal', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>Rp {(order.total_biaya_titik || 0).toLocaleString('id-ID')}</span>
                      </div>
                   )}

                   {(order.beban ?? []).map((b: any, i: number) => {
                      const isAntri = typeof b.nama === 'string' && b.nama.toLowerCase() === 'antri';
                      const label = isAntri ? 'Biaya Antrean' : `Tambahan: ${b.nama}`;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#334155', fontWeight: 'normal', textTransform: 'capitalize' }}>{label}</span>
                          <span style={{ fontWeight: 'normal', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>Rp {(b.biaya || 0).toLocaleString('id-ID')}</span>
                        </div>
                      );
                   })}
                 </div>
               </div>
            </div>

            {/* Grand Total Area */}
            <div style={{ background: '#F4FEFF', borderRadius: '16px', padding: '16px 20px', border: '1px solid #00B1C3', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0C828D', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0', padding: '0' }}>Total Tagihan</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#185356', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', margin: '0', padding: '0' }}>
                Rp {totalPaid.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Logistics & Admin Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
               {/* Left Column: Courier */}
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Kurir Operasional</div>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{resolvedCourier}</div>
                  <div style={{ color: '#475569', fontSize: '11px', fontWeight: '500', marginTop: '4px' }}>{vehiclePlate !== '-' ? vehiclePlate : ' '}</div>
               </div>
               
               {/* Right Column: Admin & Creator */}
               <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Admin & Sistem</div>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{resolvedAssigner}</div>
                  <div style={{ color: '#475569', fontSize: '11px', fontWeight: '500', marginTop: '4px', minHeight: '14px' }}>
                    {order.creator_name ? `Dibuat oleh: ${order.creator_name}` : (order.payment_confirmed_by_name ? `Verif: ${order.payment_confirmed_by_name}` : ' ')}
                  </div>
               </div>
            </div>
            
            {/* Simple footer (Compact) */}
            <div style={{ textAlign: 'center', marginTop: '24px', opacity: 0.7 }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color: '#0C828D', letterSpacing: '0.15em' }}>KURIRME</div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Bukti transaksi sah dari sistem KurirMe.</div>
            </div>
        </div>
      </div>
    </div>
  );
};

