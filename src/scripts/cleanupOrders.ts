import { supabase } from '@/lib/supabaseClient'

export async function cleanupDummyOrders() {
  const { data: snapshot, error } = await (supabase.from('orders') as any)
    .select('*')
    .not('status', 'in', '("delivered","cancelled")') as { data: any[] | null, error: any }

  if (error || !snapshot || snapshot.length === 0) {
    console.log('No orders to cleanup')
    return
  }

  console.log(`Found ${snapshot.length} orders to process`)

  let deliveredCount = 0
  let cancelledCount = 0

  // Promise.all for updates instead of Supabase bulk/RPC if needed
  const promises = snapshot.map((order: any) => {
    if (order.total_fee && order.total_fee > 0) {
      deliveredCount++
      return (supabase.from('orders') as any)
        .update({
          status: 'delivered',
          actual_delivery_time: order.created_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
    } else {
      cancelledCount++
      return (supabase.from('orders') as any)
        .update({
          status: 'cancelled',
          cancellation_reason: 'Data cleanup - no fee',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
    }
  })

  await Promise.all(promises)
  console.log(`✅ Done: ${deliveredCount} delivered, ${cancelledCount} cancelled`)
}
