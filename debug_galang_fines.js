// Debug script untuk cek total yang harus disetor Galang
// Simulasi data dari database

const galangData = {
  // Order data
  order: {
    id: 'fedfc586-6975-4172-b863-140656995c47',
    order_number: 'ORD-20260510-0001',
    total_fee: 10000,
    applied_admin_fee: 2000,
    fine_deducted: 1000,
    payment_status: 'unpaid'
  },
  
  // Fine data dari RPC get_courier_fines_complete
  completeFineData: {
    total_flat_fines: 0,
    total_per_order_fines: 1000,
    grand_total: 1000,
    per_order_fines: [{
      order_number: 'ORD-20260510-0001',
      amount: 1000,
      payment_status: 'unpaid'
    }]
  }
};

// Simulasi getAdminEarning function (setelah fix)
function getAdminEarning(order) {
  if (order.applied_admin_fee !== undefined && order.applied_admin_fee !== null) {
    return order.applied_admin_fee;
  }
  // fallback calculation...
  return 2000; // untuk order ini
}

// Simulasi perhitungan di rawCourierSummary
const totalEarning = getAdminEarning(galangData.order); // 2000
const totalFlatFines = galangData.completeFineData.total_flat_fines; // 0
const totalPerOrderFines = galangData.completeFineData.total_per_order_fines; // 1000
const totalFines = totalFlatFines + totalPerOrderFines; // 1000

console.log('=== DEBUG GALANG TOTAL SETOR ===');
console.log('Order:', galangData.order.order_number);
console.log('Admin Fee (totalEarning):', totalEarning);
console.log('Flat Fines:', totalFlatFines);
console.log('Per Order Fines:', totalPerOrderFines);
console.log('Total Fines:', totalFines);
console.log('');
console.log('TOTAL YANG HARUS DISETOR:', totalEarning + totalFines);
console.log('');
console.log('Breakdown:');
console.log('- Admin Fee: Rp', totalEarning.toLocaleString());
console.log('- Denda: Rp', totalFines.toLocaleString());
console.log('- TOTAL: Rp', (totalEarning + totalFines).toLocaleString());
console.log('');
console.log('Expected di UI: Rp 3.000');
console.log('Actual di screenshot: Rp 2.000');
console.log('');
console.log('Kemungkinan masalah:');
console.log('1. completeFineData belum ter-load saat render');
console.log('2. Race condition antara fetchAllCourierFines dan render');
console.log('3. Error di fetchCourierFines tidak ter-handle');