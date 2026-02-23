import { db } from '@/lib/firebase'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { Order, OrderStatus } from '@/types'

const generateMockOrders = (): Order[] => {
  const orders: Order[] = []
  const statuses: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']
  const firstNames = ['Budi', 'Siti', 'Ahmad', 'Dewi', 'Rizky', 'Nurul', 'Eko', 'Fitri']
  const lastNames = ['Santoso', 'Rahayu', 'Fauzi', 'Kusuma', 'Pratama', 'Hidayah', 'Wijaya', 'Putri']

  for (let i = 1; i <= 50; i++) {
    const daysAgo = i % 7
    const dateStr = new Date()
    dateStr.setDate(dateStr.getDate() - daysAgo)

    const statusIdx = (i * 3 + Math.floor(i / 5)) % statuses.length
    const status = statuses[statusIdx]
    const isCompleted = status === 'delivered'
    const hasCourier = status !== 'pending' && status !== 'cancelled'
    const courierId = hasCourier ? String((i % 3) + 3) : undefined

    orders.push({
      id: String(i),
      order_number: `P${String(dateStr.getDate()).padStart(2, '0')}${String(dateStr.getMonth() + 1).padStart(2, '0')}${String(dateStr.getFullYear()).slice(-2)}${String(i).padStart(3, '0')}`,
      customer_name: `${firstNames[(i - 1) % firstNames.length]} ${lastNames[Math.floor((i - 1) / firstNames.length) % lastNames.length]}`,
      customer_phone: `+6281${String(i).padStart(8, '0')}`,
      customer_address: `Jl. Contoh No. ${i}, Jakarta`,
      ...(courierId ? { courier_id: courierId } : {}),
      status: status,
      total_fee: 15000 + ((i % 10) * 1000),
      payment_status: isCompleted ? 'paid' : 'unpaid',
      created_at: dateStr.toISOString(),
      updated_at: dateStr.toISOString(),
      created_by: '1'
    })
  }
  return orders
}

export const seedOrders = async (): Promise<void> => {
  const colRef = collection(db, 'orders')
  const existing = await getDocs(colRef)
  if (!existing.empty) {
    console.log('Orders already seeded — skipping')
    return
  }

  const mockOrders = generateMockOrders()
  const batch = writeBatch(db)
  mockOrders.forEach(order => {
    batch.set(doc(db, 'orders', order.id), order)
  })
  await batch.commit()
  console.log(`Seeded ${mockOrders.length} orders to Firestore`)
}
