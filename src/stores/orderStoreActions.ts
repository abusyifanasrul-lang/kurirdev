/**
 * orderStoreActions.ts
 * ==========================================================================
 * Mutation actions for the Order store (Supabase writes + optimistic state).
 *
 * ARCHITECTURE NOTES:
 * - Functions receive `set` / `get` via parameter injection (NOT by
 *   importing useOrderStore) to prevent circular dependencies.
 * - Each factory returns the action function to be wired into the store.
 * - All imports are STATIC to prevent tree-shaking init-order issues.
 * ==========================================================================
 */
import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/utils/retry'
import { useToastStore } from '@/stores/useToastStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { Order, OrderStatus } from '@/types'
import { getLocalNow } from '@/utils/date'
import type { OrderStoreSet, OrderStoreGet } from './useOrderStore'

// ---------------------------------------------------------------
// addOrder
// ---------------------------------------------------------------
export function createAddOrder(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderData: any): Promise<void> => {
    const addToast = useToastStore.getState().addToast
    const removeToast = useToastStore.getState().removeToast
    let retryToastId: string | undefined

    try {
      await withRetry(async () => {
        const { data: orderNumber, error: rpcError } = await supabase.rpc('generate_order_number')
        if (rpcError) throw rpcError
        const finalOrderData = {
          ...orderData,
          order_number: orderNumber,
        }
        const { data, error } = await (supabase.from('orders') as any)
          .insert(finalOrderData)
          .select()
          .single()
        if (error) throw error
        const newOrder = data as unknown as Order
        set(state => ({ orders: [newOrder, ...state.orders] }))
      }, {
        onRetry: (attempt) => {
          if (!retryToastId) {
            retryToastId = addToast(`Koneksi tidak stabil. Mencoba kembali... (Sisa ${3 - attempt} percobaan)`, 'loading', 0)
          } else {
            useToastStore.getState().updateToast(retryToastId, {
              message: `Mencoba kembali... (Sisa ${3 - attempt} percobaan)`
            })
          }
        }
      })
    } catch (error: any) {
      throw new Error(error.message || 'Gagal menyimpan order setelah beberapa kali mencoba. Silakan cek koneksi internet Anda.')
    } finally {
      if (retryToastId) removeToast(retryToastId)
    }
  }
}

// ---------------------------------------------------------------
// updateOrderStatus
// ---------------------------------------------------------------
export function createUpdateOrderStatus(set: OrderStoreSet, get: OrderStoreGet) {
  return async (
    orderId: string,
    status: OrderStatus,
    userId: string,
    userName: string,
    notes?: string
  ): Promise<void> => {
    const isSyncing = get().isSyncingOrders.has(orderId)
    if (isSyncing) return 

    const order = get().orders.find(o => o.id === orderId)
      || get().currentOrder
      || get().activeOrdersByCourier.find(o => o.id === orderId)
      
    if (!order) return
    if (order.status === status) return 

    const setSyncing = get().setSyncing
    const addToast = useToastStore.getState().addToast
    const removeToast = useToastStore.getState().removeToast
    let retryToastId: string | undefined

    setSyncing(orderId, true)

    try {
      await withRetry(async () => {
        if (status === 'delivered') {
          const { commission_rate, commission_threshold, commission_type } = useSettingsStore.getState()
          const { error } = await (supabase.rpc as any)('complete_order', {
             p_order_id: orderId,
             p_user_id: userId,
             p_user_name: userName,
             p_notes: notes || '',
             p_commission_rate: commission_rate,
             p_commission_threshold: commission_threshold,
             p_commission_type: commission_type
          })
          if (error) throw error
          
          const updatedOrder = { 
            ...order, 
            status: 'delivered', 
            is_waiting: false, 
            applied_commission_rate: commission_rate, 
            applied_commission_threshold: commission_threshold,
            applied_commission_type: commission_type,
            actual_delivery_time: getLocalNow().toISOString() 
          }
          
          // Optimistic local state update for delivered case
          set(state => ({
            activeOrdersByCourier: state.activeOrdersByCourier.filter(o => o.id !== orderId),
            orders: [updatedOrder as Order, ...state.orders.filter(o => o.id !== orderId)],
            currentOrder: state.currentOrder?.id === orderId ? updatedOrder as Order : state.currentOrder
          }))

          console.info(`[useOrderStore] Manual delivered mirroring to localDB: ${orderId}`)
          const { moveToLocalDB } = await import('@/lib/orderCache')
          await moveToLocalDB(updatedOrder as Order).catch(err => console.error('Mirror write error:', err))
        } else {
          const updates: Partial<Order> = {
            status,
            updated_at: getLocalNow().toISOString()
          }
          if (status === 'picked_up' && !order.actual_pickup_time) {
            updates.actual_pickup_time = getLocalNow().toISOString()
          }
          if (status === 'cancelled') {
            updates.is_waiting = false
            updates.cancelled_at = getLocalNow().toISOString()
            updates.cancellation_reason = notes || ''
            updates.cancelled_by = userId
            updates.canceller_name = userName
          }

          const { error: updateError } = await (supabase.from('orders') as any).update(updates).eq('id', orderId)
          if (updateError) throw updateError

          await (supabase.from('tracking_logs') as any).insert({
            order_id: orderId,
            status,
            changed_by: userId,
            changed_by_name: userName,
            notes: notes || ''
          })

          const updatedOrder = { ...order, ...updates }

          if (status === 'cancelled') {
            console.info(`[useOrderStore] Manual cancelled mirroring to localDB: ${orderId}`)
            const { moveToLocalDB } = await import('@/lib/orderCache')
            await moveToLocalDB(updatedOrder as Order).catch(err => console.error('Mirror write error:', err))
          }

          set(state => ({
            orders: state.orders.map(o => o.id === orderId ? updatedOrder as Order : o),
            activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? updatedOrder as Order : o),
            currentOrder: state.currentOrder?.id === orderId ? updatedOrder as Order : state.currentOrder
          }))
        }
      }, {
        onRetry: (attempt) => {
          if (!retryToastId) {
            retryToastId = addToast(`Gagal sinkronasi... Mencoba kembali (${attempt}/3)`, 'loading', 0)
          } else {
            useToastStore.getState().updateToast(retryToastId, {
              message: `Sinkronasi status ${status}... (${attempt}/3)`
            })
          }
        }
      })
    } catch (error: any) {
      addToast(`Gagal memperbarui status order: ${error.message}`, 'error', 5000)
    } finally {
      setSyncing(orderId, false)
      if (retryToastId) removeToast(retryToastId)
    }
  }
}

// ---------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------
export function createCancelOrder(_set: OrderStoreSet, get: OrderStoreGet) {
  return async (
    orderId: string,
    reason: string,
    userId: string,
    userName: string,
    cancelReasonType?: string
  ): Promise<void> => {
    const { error } = await (supabase.from('orders') as any).update({
      cancellation_reason: reason,
      cancel_reason_type: cancelReasonType ?? null,
      cancelled_at: getLocalNow().toISOString(),
      updated_at: getLocalNow().toISOString(),
      is_waiting: false
    }).eq('id', orderId)
    if (error) throw error
    await get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason)
  }
}

// ---------------------------------------------------------------
// updateOrder
// ---------------------------------------------------------------
export function createUpdateOrder(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, updates: Partial<Order>): Promise<void> => {
    if (updates.payment_status === 'paid') {
        const { error: rpcError } = await (supabase.rpc as any)('mark_order_paid', { p_order_id: orderId })
        if (rpcError) throw rpcError
        const { payment_status, ...restUpdates } = updates as any
        if (Object.keys(restUpdates).length > 0) {
           await (supabase.from('orders') as any).update({ ...restUpdates, updated_at: getLocalNow().toISOString() }).eq('id', orderId)
        }
        import('@/lib/orderCache').then(({ markAsPaidInLocalDB }) => markAsPaidInLocalDB(orderId, '').catch(err => console.error('Confirm payment error:', err)))
     } else {
       const finalUpdates = { ...updates, updated_at: getLocalNow().toISOString() };
       if (updates.status === 'cancelled' || updates.status === 'delivered') {
         (finalUpdates as any).is_waiting = false;
       }
       await (supabase.from('orders') as any).update(finalUpdates).eq('id', orderId)
    }
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, ...updates } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, ...updates } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, ...updates } : state.currentOrder
    }))
  }
}

// ---------------------------------------------------------------
// updateBiayaTambahan
// ---------------------------------------------------------------
export function createUpdateBiayaTambahan(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, titik: number, beban: { nama: string; biaya: number }[]): Promise<void> => {
    const total_biaya_titik = titik * 3000;
    const total_biaya_beban = beban.reduce((sum: number, b: any) => sum + b.biaya, 0);

    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { 
        ...o, 
        titik, 
        total_biaya_titik, 
        beban, 
        total_biaya_beban 
      } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { 
        ...o, 
        titik, 
        total_biaya_titik, 
        beban, 
        total_biaya_beban 
      } : o),
      currentOrder: state.currentOrder?.id === orderId ? { 
        ...state.currentOrder, 
        titik, 
        total_biaya_titik, 
        beban, 
        total_biaya_beban 
      } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({
      titik,
      total_biaya_titik,
      beban,
      total_biaya_beban,
      updated_at: getLocalNow().toISOString()
    }).eq('id', orderId)
  }
}

// ---------------------------------------------------------------
// updateItemBarang
// ---------------------------------------------------------------
export function createUpdateItemBarang(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, itemName: string, itemPrice: number): Promise<void> => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, item_name: itemName, item_price: itemPrice } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, item_name: itemName, item_price: itemPrice } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, item_name: itemName, item_price: itemPrice } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({
      item_name: itemName,
      item_price: itemPrice,
      updated_at: getLocalNow().toISOString()
    }).eq('id', orderId);
  }
}

// ---------------------------------------------------------------
// updateOrderField
// ---------------------------------------------------------------
export function createUpdateOrderField(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, field: string, value: any): Promise<void> => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, [field]: value } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, [field]: value } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, [field]: value } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({ [field]: value, updated_at: getLocalNow().toISOString() }).eq('id', orderId)
  }
}

// ---------------------------------------------------------------
// settleOrder
// ---------------------------------------------------------------
export function createSettleOrder(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, userId: string, userName: string): Promise<void> => {
    const { error } = await (supabase.rpc as any)('settle_order', { 
      p_order_id: orderId,
      p_admin_id: userId,
      p_admin_name: userName
    })

    if (error) throw error

    await (supabase.from('tracking_logs') as any).insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: userId,
      changed_by_name: userName,
      notes: `Setoran dikonfirmasi oleh ${userName}`
    })

    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, payment_status: 'paid', payment_confirmed_by: userId, payment_confirmed_by_name: userName } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, payment_status: 'paid', payment_confirmed_by: userId, payment_confirmed_by_name: userName } : state.currentOrder
    }))

    const { markAsPaidInLocalDB } = await import('@/lib/orderCache')
    await markAsPaidInLocalDB(orderId, userId, userName)
  }
}

// ---------------------------------------------------------------
// updateItems
// ---------------------------------------------------------------
export function createUpdateItems(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, items: { nama: string; harga: number }[]): Promise<void> => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, items } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, items } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, items } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({
      items,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  }
}

// ---------------------------------------------------------------
// updateOngkir
// ---------------------------------------------------------------
export function createUpdateOngkir(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, totalFee: number): Promise<void> => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, total_fee: totalFee } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, total_fee: totalFee } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, total_fee: totalFee } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({
      total_fee: totalFee,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  }
}

// ---------------------------------------------------------------
// updateOrderWaiting
// ---------------------------------------------------------------
export function createUpdateOrderWaiting(set: OrderStoreSet, _get: OrderStoreGet) {
  return async (orderId: string, isWaiting: boolean): Promise<void> => {
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, is_waiting: isWaiting } : o),
      activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, is_waiting: isWaiting } : o),
      currentOrder: state.currentOrder?.id === orderId ? { ...state.currentOrder, is_waiting: isWaiting } : state.currentOrder
    }));

    await (supabase.from('orders') as any).update({
      is_waiting: isWaiting,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  }
}
