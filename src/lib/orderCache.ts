import Dexie, { Table } from 'dexie'
import { Order } from '@/types'

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
