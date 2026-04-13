import React, { useMemo } from 'react';
import { Order } from '@/types';
import { format } from 'date-fns';
import { useUserStore } from '@/stores/useUserStore';

interface InvoiceTemplateProps {
  order: Order;
  invoiceRef: React.RefObject<HTMLDivElement | null>;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ order, invoiceRef }) => {
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
    <div className="absolute opacity-0 pointer-events-none appearance-none h-0 overflow-hidden" aria-hidden="true" style={{ top: '-4000px', width: '500px' }}>
      <div ref={invoiceRef} style={{ background: '#ffffff', boxSizing: 'border-box', padding: '0', width: '400px', fontFamily: '"Inter", system-ui, sans-serif', color: '#111827', margin: '0' }}>
        
        {/* Header - Top Logo */}
        <div style={{ padding: '28px 24px 20px 24px', display: 'flex', alignItems: 'center', background: '#047857' }}>
          <div style={{ fontSize: '30px', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
            <span style={{ fontSize: '36px' }}>🛵</span> KurirDev
          </div>
        </div>

        {/* Banner with solid Emerald-700 */}
        <div style={{ background: '#047857', width: '100%', padding: '0 24px 48px 24px', boxSizing: 'border-box' }}>
           <div style={{ color: '#d1fae5', fontSize: '12px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
             Invoice Resmi Pengiriman
           </div>
        </div>

        {/* Floating Card - Order Num & Status */}
        <div style={{ padding: '0 24px', marginTop: '-32px', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
           <div style={{ boxSizing: 'border-box', background: '#ffffff', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '4px', textTransform: 'uppercase' }}>Nomor Pesanan</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827', letterSpacing: '-0.03em', lineHeight: '1.1' }}>#{order.order_number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '5px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  LUNAS
                </div>
                <div style={{ fontSize: '11px', color: '#4b5563', fontWeight: '700' }}>
                  {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm') : format(new Date(), 'dd MMM yyyy, HH:mm')}
                </div>
              </div>
           </div>
        </div>

        {/* Body content */}
        <div style={{ padding: '24px 24px 16px 24px', boxSizing: 'border-box' }}>
            
            {/* Ditujukan Kepada */}
             <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
               <div style={{ fontSize: '10px', fontWeight: '800', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Informasi Penerima</div>
               <div style={{ fontSize: '18px', fontWeight: '900', color: '#000000', letterSpacing: '-0.02em', lineHeight: '1.2', textTransform: 'capitalize' }}>{order.customer_name}</div>
               <div style={{ fontSize: '13px', color: '#374151', marginTop: '8px', lineHeight: '1.6', fontWeight: '500', textTransform: 'capitalize' }}>{order.customer_address}</div>
               <div style={{ fontSize: '13px', color: '#111827', marginTop: '6px', fontWeight: '800' }}>{order.customer_phone}</div>
             </div>

            {/* RINCIAN BELANJA KONSUMEN */}
            <div style={{ marginBottom: '28px' }}>
               <div style={{ fontSize: '11px', fontWeight: '900', color: '#111827', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '2px solid #111827', paddingBottom: '8px' }}>
                 Detail Item
               </div>
               {items.length > 0 ? (
                 <>
                   {items.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                         <div style={{ display: 'flex', gap: '10px', flex: 1, paddingRight: '12px' }}>
                            <span style={{ color: '#6b7280', width: '16px', fontWeight: '700' }}>{i + 1}.</span>
                            <span style={{ color: '#111827', fontWeight: '600', lineHeight: '1.5', textTransform: 'capitalize' }}>{item.nama}</span>
                         </div>
                         <div style={{ color: '#000000', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>Rp {item.harga.toLocaleString('id-ID')}</div>
                      </div>
                   ))}
                 </>
               ) : order.item_name ? (
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                    <div style={{ display: 'flex', gap: '10px', flex: 1, paddingRight: '12px' }}>
                       <span style={{ color: '#6b7280', width: '16px', fontWeight: '700' }}>1.</span>
                       <span style={{ color: '#111827', fontWeight: '600', lineHeight: '1.5', textTransform: 'capitalize' }}>{order.item_name}</span>
                    </div>
                    {itemTotal > 0 && <span style={{ color: '#000000', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>Rp {itemTotal.toLocaleString('id-ID')}</span>}
                 </div>
               ) : (
                 <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', padding: '10px 0' }}>Tidak ada pembelian barang via kurir.</div>
               )}
               
               {/* Subtotal Belanja */}
               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '13px', background: '#f3f4f6', padding: '12px 16px', borderRadius: '8px' }}>
                  <span style={{ color: '#4b5563', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtotal Belanja</span>
                  <span style={{ fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums' }}>Rp {itemTotal.toLocaleString('id-ID')}</span>
               </div>
            </div>

            {/* BIAYA PENGIRIMAN & LAYANAN */}
            <div style={{ marginBottom: '32px' }}>
               <div style={{ fontSize: '11px', fontWeight: '900', color: '#111827', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '2px solid #111827', paddingBottom: '8px' }}>
                 Detail Layanan & Ongkir
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px' }}>
                  <span style={{ color: '#374151', fontWeight: '600' }}>Ongkos Kirim Dasar</span>
                  <span style={{ fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums' }}>Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
               </div>

               {(order.titik ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px' }}>
                    <span style={{ color: '#374151', fontWeight: '600' }}>Tambahan {order.titik} Titik Alamat</span>
                    <span style={{ fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums' }}>Rp {(order.total_biaya_titik || 0).toLocaleString('id-ID')}</span>
                  </div>
               )}

               {(order.beban ?? []).map((b: any, i: number) => {
                  const isAntri = typeof b.nama === 'string' && b.nama.toLowerCase() === 'antri';
                  const label = isAntri ? 'Biaya Antrean' : `Tambahan: ${b.nama}`;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px' }}>
                      <span style={{ color: '#374151', fontWeight: '600', textTransform: 'capitalize' }}>{label}</span>
                      <span style={{ fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums' }}>Rp {(b.biaya || 0).toLocaleString('id-ID')}</span>
                    </div>
                  );
               })}
               
               {/* Subtotal Pengiriman */}
               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '13px', background: '#f3f4f6', padding: '12px 16px', borderRadius: '8px' }}>
                  <span style={{ color: '#4b5563', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtotal Layanan</span>
                  <span style={{ fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums' }}>Rp {((order.total_fee || 0) + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
               </div>
            </div>

            {/* Total Akhir */}
            <div style={{ background: '#ecfdf5', borderRadius: '12px', padding: '20px 24px', border: '2px solid #059669', marginBottom: '36px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.1)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                     <div style={{ fontSize: '13px', fontWeight: '900', color: '#047857', letterSpacing: '0.1em', textTransform: 'uppercase' }}>GRAND TOTAL</div>
                     <div style={{ fontSize: '10px', color: '#059669', marginTop: '4px', fontWeight: '800', letterSpacing: '0.05em' }}>BELANJA + PENGIRIMAN</div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#064e3b', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                     Rp {totalPaid.toLocaleString('id-ID')}
                  </div>
               </div>
            </div>

            {/* Delivery details footer */}
            <div style={{ marginBottom: '16px' }}>
               <div style={{ fontSize: '11px', fontWeight: '900', color: '#111827', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '2px solid #111827', paddingBottom: '8px' }}>
                 Detail Pengiriman
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Courier */}
                  <div>
                     <div style={{ fontSize: '10px', fontWeight: '800', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Kurir Operasional</div>
                     <div style={{ fontWeight: '900', color: '#000000', fontSize: '16px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {resolvedCourier} 
                        <span style={{ color: '#9ca3af', fontWeight: '500' }}>•</span> 
                        <span style={{ color: '#4b5563', fontSize: '14px', fontWeight: '700' }}>{vehiclePlate}</span>
                     </div>
                  </div>
                  
                  {/* Admin */}
                  <div>
                     <div style={{ color: '#9ca3af', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Diproses Oleh Sistem</div>
                     <div style={{ fontWeight: '700', color: '#6b7280', fontSize: '12px' }}>{resolvedAssigner}</div>
                  </div>
               </div>
            </div>
            
            {/* Simple footer */}
            <div style={{ textAlign: 'center', marginTop: '48px', opacity: 0.8 }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#4b5563', letterSpacing: '0.2em' }}>KURIRDEV.COM</div>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', fontWeight: '600' }}>Terima kasih telah menggunakan layanan kami.</div>
            </div>
        </div>
      </div>
    </div>
  );
};

