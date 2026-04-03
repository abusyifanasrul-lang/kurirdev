import Dexie, { Table } from 'dexie'
import { Order, Customer } from '@/types'

// Helper function untuk konversi UTC ke local timezone
function getLocalDateStr(
  isoString: string
): string {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    date.getDate()
  ).padStart(2, '0')
  return `${year}-${month}-${day}` 
}

// Per-user sync metadata
// Setiap user punya status sync sendiri
// agar shared DB bisa dipakai bergantian
export interface UserSyncStatus {
  sync_completed: boolean
  last_delta_sync: string  // ISO timestamp
  last_sync: string        // ISO timestamp
}

export interface DBMeta {
  total_records: number
  users: Record<string, UserSyncStatus>
  // Legacy fields (backward compat)
  last_sync?: string
  sync_completed?: boolean
  last_delta_sync?: string
  last_customer_sync?: string
}

const META_KEY = 'kurirdev_db_meta'

function getMeta(): DBMeta {
  const raw = localStorage.getItem(META_KEY)
  if (!raw) return {
    total_records: 0,
    users: {}
  }
  const parsed = JSON.parse(raw)
  // Migrasi dari format lama ke per-user
  if (!parsed.users) {
    parsed.users = {}
  }
  return parsed
}

function saveMeta(meta: Partial<DBMeta>) {
  const current = getMeta()
  localStorage.setItem(META_KEY,
    JSON.stringify({ ...current, ...meta })
  )
}

function getUserSyncStatus(
  userId: string
): UserSyncStatus {
  const meta = getMeta()
  return meta.users[userId] || {
    sync_completed: false,
    last_delta_sync: '',
    last_sync: ''
  }
}

function saveUserSyncStatus(
  userId: string,
  status: Partial<UserSyncStatus>
) {
  const meta = getMeta()
  const current = meta.users[userId] || {
    sync_completed: false,
    last_delta_sync: '',
    last_sync: ''
  }
  meta.users[userId] = { ...current, ...status }
  saveMeta({ users: meta.users })
}

class KurirDevDB extends Dexie {
  orders!: Table<Order & { _date: string }>
  customers!: Table<Customer>
  notifications!: Table<import('@/types').Notification>

  constructor() {
    super('KurirDevCache')
    this.version(1).stores({
      orders: 'id, _date, courier_id, status, created_at'
    })
    this.version(2).stores({
      orders: 'id, _date, courier_id, status, created_at',
      customers: 'id, name, phone, updated_at'
    })
    this.version(3).stores({
      orders: 'id, _date, courier_id, status, created_at',
      customers: 'id, name, phone, updated_at',
      notifications: 'id, user_id, is_read, sent_at'
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
    dates.push(getLocalDateStr(current.toISOString()))
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
// dilakukan untuk user ini di device ini
export function isInitialSyncCompleted(
  userId: string
): boolean {
  // Cek per-user status
  const userStatus = getUserSyncStatus(userId)
  if (userStatus.sync_completed) return true
  // Fallback: cek legacy global flag
  // (migrasi dari format lama)
  const meta = getMeta()
  if (meta.sync_completed && !userStatus.sync_completed) {
    // Migrasi: tandai user ini sebagai synced
    saveUserSyncStatus(userId, {
      sync_completed: true,
      last_delta_sync: meta.last_delta_sync || '',
      last_sync: meta.last_sync || ''
    })
    return true
  }
  return false
}

// Cek apakah perlu delta sync hari ini
// untuk user tertentu
export function needsDeltaSync(
  userId: string
): boolean {
  const userStatus = getUserSyncStatus(userId)
  if (!userStatus.last_delta_sync) return true
  const lastSync = new Date(
    userStatus.last_delta_sync
  )
  const today = new Date()
  return lastSync.toDateString()
    !== today.toDateString()
}

// Sync semua order final (delivered/cancelled)
// dari Supabase ke IndexedDB
// Dipanggil SEKALI saat device baru
export async function syncAllFinalOrders(
  fetchFn: (start: Date, end: Date)
    => Promise<import('@/types').Order[]>,
  userId: string
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
      _date: getLocalDateStr(o.created_at)
    }))
    await localDB.orders.bulkPut(tagged)
  }

  const total = await localDB.orders.count()
  saveMeta({ total_records: total })
  saveUserSyncStatus(userId, {
    last_sync: new Date().toISOString(),
    sync_completed: true,
    last_delta_sync: new Date().toISOString()
  })

  return finalOrders.length
}

// Delta sync: ambil order final kemarin
// Dipanggil setiap hari pertama buka app
export async function deltaSyncYesterday(
  fetchFn: (start: Date, end: Date)
    => Promise<import('@/types').Order[]>,
  userId: string
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
      _date: getLocalDateStr(o.created_at)
    }))
    await localDB.orders.bulkPut(tagged)
  }

  const total = await localDB.orders.count()
  saveMeta({ total_records: total })
  saveUserSyncStatus(userId, {
    last_delta_sync: new Date().toISOString()
  })

  return finalOrders.length
}

// Simpan satu order final ke IndexedDB
export async function moveToLocalDB(
  order: import('@/types').Order
): Promise<void> {
  await localDB.orders.put({
    ...order,
    _date: getLocalDateStr(order.created_at)
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
  
  // 7 hari terakhir dari hari ini
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(
    today.getDate() - 6
  )
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const startStr = getLocalDateStr(
    sevenDaysAgo.toISOString()
  )
  const endStr = getLocalDateStr(
    today.toISOString()
  )

  const orders = await localDB.orders
    .where('_date')
    .between(startStr, endStr, true, true)
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

// Ambil SEMUA unpaid orders (untuk Finance Penagihan)
export async function getAllUnpaidOrdersLocal(): Promise<import('@/types').Order[]> {
  const all = await localDB.orders.toArray()
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

// Ambil semua order final milik kurir
// tertentu dari IndexedDB (untuk History)
export async function getOrdersByCourierFromLocal(
  courierId: string
): Promise<import('@/types').Order[]> {
  const all = await localDB.orders
    .where('courier_id')
    .equals(courierId)
    .toArray()

  return all
    .filter(o =>
      o.status === 'delivered' ||
      o.status === 'cancelled'
    )
    .map(({ _date, ...o }) =>
      o as import('@/types').Order
    )
    .sort((a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
    )
}

// Ambil semua order aktif milik kurir tertentu dari IndexedDB
export async function getCachedOrdersByCourierActive(
  courierId: string
): Promise<import('@/types').Order[]> {
  const all = await localDB.orders
    .where('courier_id')
    .equals(courierId)
    .toArray()

  return all
    .filter(o => 
      ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status)
    )
    .map(({ _date, ...o }) => o as import('@/types').Order)
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

export async function getOrdersByDateRange(
  start: string,
  end: string
): Promise<import('@/types').Order[]> {
  const startStr = getLocalDateStr(start);
  const endStr = getLocalDateStr(end);

  const orders = await localDB.orders
    .where('_date')
    .between(startStr, endStr, true, true)
    .toArray();

  return orders.map(({ _date, ...o }) => o as import('@/types').Order);
}

// --- Customer Cache Methods ---

export async function upsertCustomerLocal(customer: Customer): Promise<void> {
  await localDB.customers.put(customer)
}

export async function getAllCustomersLocal(): Promise<Customer[]> {
  return await localDB.customers.toArray()
}

export function saveCustomerSyncTime(timeIso?: string): void {
  saveMeta({ last_customer_sync: timeIso || new Date().toISOString() })
}

export function getCustomerSyncTime(): string | null {
  return getMeta().last_customer_sync || null
}

// --- Analytics: local-first aggregation (zero Firebase reads) ---

// Ambil order 30 hari terakhir dari IndexedDB
export async function getOrdersForMonth(): Promise<import('@/types').Order[]> {
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const startStr = getLocalDateStr(thirtyDaysAgo.toISOString())
  const endStr = getLocalDateStr(today.toISOString())

  const orders = await localDB.orders
    .where('_date')
    .between(startStr, endStr, true, true)
    .toArray()

  return orders.map(({ _date, ...o }) => o as import('@/types').Order)
}

// Top N pelanggan berdasarkan jumlah order dari IndexedDB
export async function getTopCustomers(
  limit = 5
): Promise<{ name: string; order_count: number; total_fee: number }[]> {
  const all = await localDB.orders
    .filter(o => o.status === 'delivered')
    .toArray()

  const map = new Map<string, { name: string; order_count: number; total_fee: number }>()
  for (const o of all) {
    const key = o.customer_id || o.customer_name
    const existing = map.get(key)
    if (existing) {
      existing.order_count++
      existing.total_fee += o.total_fee || 0
    } else {
      map.set(key, {
        name: o.customer_name,
        order_count: 1,
        total_fee: o.total_fee || 0,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.order_count - a.order_count)
    .slice(0, limit)
}

// Top N kurir berdasarkan jumlah delivery dari IndexedDB
export async function getTopCouriers(
  limit = 5,
  courierNames: Record<string, string> = {}
): Promise<{ id: string; name: string; delivery_count: number; total_fee: number }[]> {
  const all = await localDB.orders
    .filter(o => o.status === 'delivered' && !!o.courier_id)
    .toArray()

  const map = new Map<string, { id: string; name: string; delivery_count: number; total_fee: number }>()
  for (const o of all) {
    const cid = o.courier_id!
    const existing = map.get(cid)
    if (existing) {
      existing.delivery_count++
      existing.total_fee += o.total_fee || 0
    } else {
      map.set(cid, {
        id: cid,
        name: courierNames[cid] || `Kurir ${cid.slice(0, 6)}`,
        delivery_count: 1,
        total_fee: o.total_fee || 0,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.delivery_count - a.delivery_count)
    .slice(0, limit)
}

// Cari order yang kehilangan referensi kurir (orphaned)
export async function getOrphanedOrdersLocal(
  activeCourierIds: string[]
): Promise<import('@/types').Order[]> {
  const all = await localDB.orders
    .toArray();
  
  return all
    .filter(o => 
      o.courier_id && 
      !activeCourierIds.includes(o.courier_id)
    )
    .map(({ _date, ...o }) => o as import('@/types').Order);
}

// --- Notification Cache Methods ---

export async function cacheNotifications(notifications: import('@/types').Notification[]): Promise<void> {
  if (notifications.length === 0) return
  await localDB.notifications.bulkPut(notifications)
}

export async function getCachedNotifications(userId?: string): Promise<import('@/types').Notification[]> {
  let query = localDB.notifications.toCollection()
  
  if (userId) {
    query = localDB.notifications.where('user_id').equals(userId)
  }
  
  const all = await query.reverse().sortBy('sent_at')
  return all as import('@/types').Notification[]
}

export async function markNotificationReadLocal(id: string): Promise<void> {
  const notif = await localDB.notifications.get(id)
  if (notif) {
    await localDB.notifications.put({ ...notif, is_read: true })
  }
}
