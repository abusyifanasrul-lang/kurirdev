import { db } from '@/lib/firebase'
import {
  collection, getDocs, query,
  where, writeBatch, doc
} from 'firebase/firestore'

export async function cleanupDummyOrders() {
  const q = query(
    collection(db, 'orders'),
    where('status', 'not-in',
      ['delivered', 'cancelled'])
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    console.log('No orders to cleanup')
    return
  }

  console.log(`Found ${snapshot.docs.length} orders to process`)

  const batch = writeBatch(db)
  let deliveredCount = 0
  let cancelledCount = 0

  snapshot.docs.forEach(docSnap => {
    const order = docSnap.data()
    const ref = doc(db, 'orders', docSnap.id)

    if (order.total_fee && order.total_fee > 0) {
      batch.update(ref, {
        status: 'delivered',
        actual_delivery_time: order.created_at,
        updated_at: new Date().toISOString()
      })
      deliveredCount++
    } else {
      batch.update(ref, {
        status: 'cancelled',
        cancellation_reason: 'Data cleanup - no fee',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      cancelledCount++
    }
  })

  await batch.commit()
  console.log(`✅ Done: ${deliveredCount} delivered, ${cancelledCount} cancelled`)
}
