import React from 'react';
import { Order } from '@/types';
import { format } from 'date-fns';
import { useUserStore } from '@/stores/useUserStore';

interface InvoiceTemplateProps {
  order: Order;
  invoiceRef: React.RefObject<HTMLDivElement>;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ order, invoiceRef }) => {
  const { users } = useUserStore();
  
  const items = order.items || [];
  const itemTotal = items.reduce((sum, item) => sum + item.harga, 0) || (order.item_price ?? 0);
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

  return (
    <div className="absolute opacity-0 pointer-events-none appearance-none h-0 overflow-hidden" aria-hidden="true" style={{ top: '-4000px', width: '500px' }}>
      <div ref={invoiceRef} style={{ background: '#ffffff', padding: '32px', width: '360px', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', color: '#111827' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '2px solid #111827', marginBottom: '20px' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>🛵</span> KurirDev
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px', fontWeight: '700' }}>
            Invoice Pengiriman
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#111827', marginTop: '12px', letterSpacing: '-0.02em' }}>
            #{order.order_number}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm') : format(new Date(), 'dd MMM yyyy, HH:mm')}
          </div>
        </div>

        {/* Customer Info */}
        <div style={{ paddingBottom: '16px', borderBottom: '1px dashed #d1d5db', marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>
            Penerima
          </div>
          <div style={{ fontWeight: '800', fontSize: '14px', color: '#111827' }}>
            {order.customer_name}
          </div>
          <div style={{ color: '#4b5563', marginTop: '4px', lineHeight: '1.5', fontSize: '11px' }}>
            {order.customer_address}
          </div>
          <div style={{ color: '#4b5563', marginTop: '4px', fontSize: '11px', fontWeight: '600' }}>
            {order.customer_phone}
          </div>
        </div>

        {/* Items List */}
        {(items.length > 0) ? (
          <div style={{ paddingBottom: '16px', borderBottom: '1px dashed #d1d5db', marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '10px' }}>
              Daftar Pesanan
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#374151', flex: 1, paddingRight: '12px' }}>{item.nama}</span>
                <span style={{ color: '#111827', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  Rp {item.harga.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px', borderTop: '1px solid #f3f4f6', fontWeight: '800' }}>
              <span style={{ color: '#374151' }}>Subtotal Belanja</span>
              <span style={{ color: '#111827' }}>Rp {itemTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        ) : order.item_name ? (
          <div style={{ paddingBottom: '16px', borderBottom: '1px dashed #d1d5db', marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '10px' }}>
              Nama Barang
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#374151' }}>{order.item_name}</span>
              {itemTotal > 0 && (
                <span style={{ fontWeight: '700', color: '#111827' }}>
                  Rp {itemTotal.toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Shipping Details */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '10px' }}>
            Biaya Layanan
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#374151' }}>Ongkos Kirim</span>
            <span style={{ fontWeight: '600' }}>Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
          </div>
          {(order.titik ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingLeft: '8px' }}>
              <span style={{ color: '#6b7280' }}>• Tambahan {order.titik} Titik</span>
              <span style={{ color: '#6b7280' }}>Rp {(order.total_biaya_titik || 0).toLocaleString('id-ID')}</span>
            </div>
          )}
          {(order.beban ?? []).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingLeft: '8px' }}>
              <span style={{ color: '#6b7280' }}>• {b.nama}</span>
              <span style={{ color: '#6b7280' }}>Rp {b.biaya.toLocaleString('id-ID')}</span>
            </div>
          ))}
        </div>

        {/* Total Price */}
        <div style={{ background: '#ecfdf5', borderRadius: '12px', padding: '16px', border: '1px solid #d1fae5', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px', color: '#065f46' }}>
            <span>TOTAL DIBAYAR</span>
            <span>Rp {totalPaid.toLocaleString('id-ID')}</span>
          </div>
          <div style={{ fontSize: '9px', color: '#059669', marginTop: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sudah termasuk biaya belanja + ongkir
          </div>
        </div>

        {/* Personnel Section - The "Signature" Area */}
        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '8px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
              Petugas Admin
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827' }}>
              {resolvedAssigner}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
              Kurir Pengirim
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827' }}>
              {resolvedCourier}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '10px', marginTop: '24px', fontStyle: 'italic' }}>
          Terima kasih telah mempercayai KurirDev 🙏
        </div>
      </div>
    </div>
  );
};
