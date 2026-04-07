import { supabase } from '@/lib/supabaseClient'

export interface CleanupResult {
  count: number
  delivered: number
  cancelled: number
  error?: any
}

export async function cleanupDummyOrders(options: { dryRun?: boolean; safetyBufferMinutes?: number } = {}): Promise<CleanupResult> {
  const { dryRun = false, safetyBufferMinutes = 60 } = options
  
  // Hitung batas waktu (buffer) untuk menghindari menghapus order yang masih sangat baru
  const bufferTime = new Date(Date.now() - safetyBufferMinutes * 60 * 1000).toISOString()

  const { data: snapshot, error } = await (supabase.from('orders') as any)
    .select('*')
    .not('status', 'in', '("delivered","cancelled")')
    .lt('created_at', bufferTime) as { data: any[] | null, error: any }

  if (error) {
    console.error('Error fetching orders for cleanup:', error)
    return { count: 0, delivered: 0, cancelled: 0, error }
  }

  if (!snapshot || snapshot.length === 0) {
    return { count: 0, delivered: 0, cancelled: 0 }
  }

  let toDeliver = 0
  let toCancel = 0

  const updates = snapshot.map((order: any) => {
    const isDeliverable = (order.total_fee && parseFloat(order.total_fee) > 0)
    if (isDeliverable) toDeliver++
    else toCancel++

    if (dryRun) return Promise.resolve()

    if (isDeliverable) {
      return (supabase.from('orders') as any)
        .update({
          status: 'delivered',
          actual_delivery_time: order.created_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
    } else {
      return (supabase.from('orders') as any)
        .update({
          status: 'cancelled',
          cancellation_reason: 'Maintenance cleanup - stale dummy order',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
    }
  })

  if (!dryRun) {
    await Promise.all(updates)
  }

  return {
    count: snapshot.length,
    delivered: toDeliver,
    cancelled: toCancel
  }
}

/**
 * Helper to just get stats without performing updates
 */
export async function getCleanupStats(safetyBufferMinutes = 60): Promise<CleanupResult> {
  return cleanupDummyOrders({ dryRun: true, safetyBufferMinutes })
}
