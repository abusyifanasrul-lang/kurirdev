import Dexie, { Table } from 'dexie'
import { Order } from '@/types'

// Tambahkan di bagian atas setelah import:
interface DBMeta {
  last_sync: string        // ISO timestamp
  total_records: number
  sync_completed: boolean
  last_delta_sync: string  // ISO timestamp
}

const META_KEY = 'kurirdev_db_meta'

function getMeta(): DBMeta {
  const raw = localStorage.getItem(META_KEY)
  if (!raw) return {
    last_sync: '',
    total_records: 0,
    sync_completed: false,
    last_delta_sync: ''
  }
  return JSON.parse(raw)
}

function saveMeta(meta: Partial<DBMeta>) {
  const current = getMeta()
  localStorage.setItem(META_KEY,
    JSON.stringify({ ...current, ...meta })
  )
}

class KurirDevDB extends Dexie {
  orders!: Table<Order & { _date: string }>
  constructor() {
    super('KurirDevCache')
    this.version(1).stores({
      orders: 'id, _date, courier_id, status, created_at'
    })
  }
}

export const localDB = new KurirDevDB()

export async function cacheOrdersByDate(
  date: string,
  orders: Order[]
) {
  const tagged = orders.map(o => ({ ...o, _date: date }))
  await localDB.orders.bulkPut(tagged)
}

export async function getCachedOrdersByDate(
  date: string
): Promise<Order[] | null> {
  const cached = await localDB.orders
    .where('_date').equals(date).toArray()
  return cached.length > 0
    ? cached.map(({ _date, ...o }) => o as Order)
    : null
}

export async function isDateCached(
  date: string
): Promise<boolean> {
  const count = await localDB.orders
    .where('_date').equals(date).count()
  return count > 0
}

export async function getCachedOrdersByRange(
  start: string,
  end: string
): Promise<{
  orders: Order[]
  missingDates: string[]
}> {
  const dates: string[] = []
  const current = new Date(start)
  const endDate = new Date(end)
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  const missingDates: string[] = []
  let allOrders: Order[] = []
  for (const date of dates) {
    const cached = await getCachedOrdersByDate(date)
    if (cached) {
      allOrders = [...allOrders, ...cached]
    } else {
      missingDates.push(date)
    }
  }
  return { orders: allOrders, missingDates }
}

// Cek apakah initial sync sudah pernah
// dilakukan di device ini
export function isInitialSyncCompleted()
  : boolean {
  return getMeta().sync_completed
}

// Cek apakah perlu delta sync hari ini
export function needsDeltaSync(): boolean {
  const meta = getMeta()
  if (!meta.last_delta_sync) return true
  const lastSync = new Date(meta.last_delta_sync)
  const today = new Date()
  return lastSync.toDateString()
    !== today.toDateString()
}

// Sync semua order final (delivered/cancelled)
// dari Firestore ke IndexedDB
// Dipanggil SEKALI saat device baru
export async function syncAllFinalOrders(
  fetchFn: (start: Date, end: Date)
    => Promise<import('@/types').Order[]>
): Promise<number> {
  // Ambil dari awal tahun hingga kemarin
  const end = new Date()
  end.setDate(end.getDate() - 1)
  end.setHours(23, 59, 59, 999)
  const start = new Date('2024-01-01')

  const orders = await fetchFn(start, end)
  const finalOrders = orders.filter(o =>
    o.status === 'delivered' ||
    o.status === 'cancelled'
  )

  if (finalOrders.length > 0) {
    const tagged = finalOrders.map(o => ({
      ...o,
      _date: o.created_at.split('T')[0]
    }))
    await localDB.orders.bulkPut(tagged)
  }

  const total = await localDB.orders.count()
  saveMeta({
    last_sync: new Date().toISOString(),
    total_records: total,
    sync_completed: true,
    last_delta_sync: new Date().toISOString()
  })

  return finalOrders.length
}

// Delta sync: ambil order final kemarin
// Dipanggil setiap hari pertama buka app
export async function deltaSyncYesterday(
  fetchFn: (start: Date, end: Date)
    => Promise<import('@/types').Order[]>
): Promise<number> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(yesterday)
  end.setHours(23, 59, 59, 999)

  const orders = await fetchFn(start, end)
  const finalOrders = orders.filter(o =>
    o.status === 'delivered' ||
    o.status === 'cancelled'
  )

  if (finalOrders.length > 0) {
    const tagged = finalOrders.map(o => ({
      ...o,
      _date: o.created_at.split('T')[0]
    }))
    await localDB.orders.bulkPut(tagged)
  }

  const total = await localDB.orders.count()
  saveMeta({
    last_delta_sync: new Date().toISOString(),
    total_records: total
  })

  return finalOrders.length
}

// Simpan satu order final ke IndexedDB
export async function moveToLocalDB(
  order: import('@/types').Order
): Promise<void> {
  await localDB.orders.put({
    ...order,
    _date: order.created_at.split('T')[0]
  })
  const total = await localDB.orders.count()
  saveMeta({ total_records: total })
}

// Hapus order dari IndexedDB
export async function removeFromLocalDB(
  orderId: string
): Promise<void> {
  await localDB.orders.delete(orderId)
  const total = await localDB.orders.count()
  saveMeta({ total_records: total })
}

// Ambil order pekan ini dari IndexedDB
export async function getOrdersForWeek()
  : Promise<import('@/types').Order[]> {
  const monday = new Date()
  const day = monday.getDay()
  const diff = day === 0 ? 6 : day - 1
  monday.setDate(monday.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  const startStr = monday
    .toISOString().split('T')[0]

  const orders = await localDB.orders
    .where('_date')
    .aboveOrEqual(startStr)
    .toArray()

  return orders.map(({ _date, ...o }) =>
    o as import('@/types').Order
  )
}

// Ambil semua unpaid orders per kurir
// dari IndexedDB
export async function getUnpaidOrdersByCourier(
  courierId: string
): Promise<import('@/types').Order[]> {
  const all = await localDB.orders
    .where('courier_id')
    .equals(courierId)
    .toArray()

  return all
    .filter(o =>
      o.status === 'delivered' &&
      o.payment_status === 'unpaid'
    )
    .map(({ _date, ...o }) =>
      o as import('@/types').Order
    )
}

// Update payment_status di IndexedDB
// saat order dikonfirmasi setor
export async function markAsPaidInLocalDB(
  orderId: string
): Promise<void> {
  const order = await localDB.orders
    .get(orderId)
  if (order) {
    await localDB.orders.put({
      ...order,
      payment_status: 'paid'
    })
  }
}

// Integrity check: bandingkan jumlah
// record IndexedDB vs metadata
export async function checkIntegrity()
  : Promise<{
    ok: boolean
    localCount: number
    metaCount: number
  }> {
  const localCount =
    await localDB.orders.count()
  const metaCount = getMeta().total_records
  return {
    ok: localCount === metaCount,
    localCount,
    metaCount
  }
}

// Reset semua cache (untuk manual sync)
export async function clearAllCache()
  : Promise<void> {
  try {
    // Hapus semua records via Dexie
    await localDB.orders.clear()
  } catch (e) {
    console.error('Dexie clear error:', e)
  }

  try {
    // Hapus database IndexedDB sepenuhnya
    // menggunakan native API sebagai fallback
    await new Promise<void>(
      (resolve, reject) => {
        const req = indexedDB.deleteDatabase(
          'KurirDevCache'
        )
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => {
          console.warn('IndexedDB delete blocked')
          resolve()
        }
      }
    )
  } catch (e) {
    console.error('IndexedDB delete error:', e)
  }

  // Hapus semua localStorage keys
  // yang terkait KurirDev cache
  localStorage.removeItem('kurirdev_db_meta')
  localStorage.removeItem(
    'pwa_update_dismissed'
  )
}

// Ambil metadata untuk ditampilkan
// di Settings
export function getCacheMeta(): DBMeta {
  return getMeta()
}
