import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { Order } from '@/types'
import { calcCourierEarning } from '@/lib/calcEarning'
import { useSettingsStore } from '@/stores/useSettingsStore'

export const backfillCourierSummary = async (): Promise<void> => {
  console.log('🔄 Backfill dimulai...')

  const { commission_rate, commission_threshold } = useSettingsStore.getState()

  const snapshot = await getDocs(
    query(collection(db, 'orders'), where('status', '==', 'delivered'))
  )

  const summaryMap: Record<string, {
    total_deliveries: number
    total_earnings: number
    unpaid_count: number
    unpaid_amount: number
  }> = {}

  snapshot.docs.forEach(d => {
    const order = d.data() as Order
    if (!order.courier_id) return

    if (!summaryMap[order.courier_id]) {
      summaryMap[order.courier_id] = {
        total_deliveries: 0,
        total_earnings: 0,
        unpaid_count: 0,
        unpaid_amount: 0
      }
    }

    const effectiveSettings = {
      commission_rate: order.applied_commission_rate ?? commission_rate,
      commission_threshold: order.applied_commission_threshold ?? commission_threshold
    }

    const earning = calcCourierEarning(order, effectiveSettings)

    summaryMap[order.courier_id].total_deliveries += 1
    summaryMap[order.courier_id].total_earnings += earning

    if (order.payment_status === 'unpaid') {
      summaryMap[order.courier_id].unpaid_count += 1
      summaryMap[order.courier_id].unpaid_amount += earning
    }
  })

  const courierIds = Object.keys(summaryMap)
  console.log(`📊 ${snapshot.docs.length} order delivered dari ${courierIds.length} kurir`)

  const updatePromises = courierIds.map(courierId =>
    updateDoc(doc(db, 'users', courierId), {
      total_deliveries_alltime: summaryMap[courierId].total_deliveries,
      total_earnings_alltime: summaryMap[courierId].total_earnings,
      unpaid_count: summaryMap[courierId].unpaid_count,
      unpaid_amount: summaryMap[courierId].unpaid_amount,
      updated_at: new Date().toISOString()
    })
  )

  await Promise.all(updatePromises)
  console.log(`✅ Backfill selesai: ${courierIds.length} kurir diupdate`)
  console.log('📋 Detail:', JSON.stringify(summaryMap, null, 2))
}
