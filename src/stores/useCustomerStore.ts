import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Customer, CustomerAddress, CustomerChangeRequest } from '@/types'
import { getAllCustomersLocal, upsertCustomerLocal, saveCustomerSyncTime, getCustomerSyncTime } from '@/lib/orderCache'

// Module-level tracker for active channels with reference counting
const activeChannels = new Map<string, any>()
const channelStates = new Map<string, 'joining' | 'joined' | 'errored' | 'closed'>()
const channelRefs = new Map<string, number>()

interface CustomerState {
  customers: Customer[]
  changeRequests: CustomerChangeRequest[]
  isLoaded: boolean

  loadFromLocal: () => Promise<void>
  syncFromServer: () => Promise<void>
  upsertCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer>
  addAddress: (customerId: string, addr: Omit<CustomerAddress, 'id'>) => Promise<void>
  updateAddress: (customerId: string, addrId: string, data: Partial<CustomerAddress>) => Promise<void>
  deleteAddress: (customerId: string, addrId: string) => Promise<void>

  findByPhone: (phone: string) => Customer | undefined
  search: (searchQuery: string) => Customer[]
  
  // Admin Methods
  fetchPendingRequests: () => Promise<CustomerChangeRequest[]>
  approveRequest: (requestId: string, adminId: string, modifiedAddress?: string) => Promise<void>
  rejectRequest: (requestId: string, adminId: string, notes: string) => Promise<void>
  createAddressChangeRequest: (
    customerId: string, 
    changeType: 'address_add' | 'address_edit' | 'address_delete' | 'full_update',
    oldData: Partial<Customer>,
    newData: Partial<Customer>,
    orderId?: string,
    requesterId?: string,
    requesterName?: string,
    newAddress?: CustomerAddress,
    affectedAddressId?: string
  ) => Promise<void>
  
  // Real-time Subscriptions Status
  realtimeStatus: Record<string, string>
  subscribeToRequests: () => () => void
  subscribeToCustomers: () => () => void
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  changeRequests: [],
  isLoaded: false,
  realtimeStatus: {},

  loadFromLocal: async () => {
    try {
      const localCustomers = await getAllCustomersLocal()
      set({ customers: localCustomers, isLoaded: true })
    } catch (err) {
      console.error('Failed to load customers from localDB', err)
      set({ isLoaded: true })
    }
  },

  syncFromServer: async () => {
    const lastSync = getCustomerSyncTime()
    try {
      let query = supabase.from('customers').select('*')
      if (lastSync) {
        query = query.gt('updated_at', lastSync)
      }
      
      const { data: fetched, error } = await query
      
      if (error) throw error

      if (fetched && fetched.length > 0) {
        for (const customer of fetched) {
          await upsertCustomerLocal(customer as unknown as Customer)
        }

        const localCustomers = await getAllCustomersLocal()
        set({ customers: localCustomers })
      }
      saveCustomerSyncTime()
    } catch (error) {
      console.error('Error syncing customers:', error)
    }
  },

  upsertCustomer: async (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    const { customers } = get()
    
    // Use Supabase upsert with onConflict on 'phone' to handle existing customers correctly
    // even if the local store is not yet synced.
    const customerData = {
      name: data.name,
      phone: data.phone,
      addresses: data.addresses,
      order_count: (data as any).order_count,
      last_order_at: (data as any).last_order_at,
      updated_at: new Date().toISOString()
    }

    const { data: upserted, error } = await supabase
      .from('customers')
      .upsert(customerData as any, { onConflict: 'phone' })
      .select()
      .single()

    if (error) throw error

    const customer = upserted as unknown as Customer
    await upsertCustomerLocal(customer)
    
    const existingIndex = customers.findIndex(c => c.id === customer.id)
    if (existingIndex === -1) {
      set({ customers: [...customers, customer] })
    } else {
      set({ customers: customers.map(c => c.id === customer.id ? customer : c) })
    }

    return customer
  },

  addAddress: async (customerId, addr) => {
    const { customers } = get()
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    const newAddress: CustomerAddress = { ...addr, id: crypto.randomUUID() }
    const updatedCustomer: Customer = {
      ...customer,
      addresses: [...customer.addresses, newAddress],
      updated_at: new Date().toISOString()
    }

    await (supabase.from('customers') as any).upsert(updatedCustomer)
    await upsertCustomerLocal(updatedCustomer)
    set({ customers: customers.map(c => c.id === customerId ? updatedCustomer : c) })
  },

  updateAddress: async (customerId, addrId, data) => {
    const { customers } = get()
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    const updatedCustomer: Customer = {
      ...customer,
      addresses: customer.addresses.map(a => a.id === addrId ? { ...a, ...data } : a),
      updated_at: new Date().toISOString()
    }

    await (supabase.from('customers') as any).upsert(updatedCustomer)
    await upsertCustomerLocal(updatedCustomer)
    set({ customers: customers.map(c => c.id === customerId ? updatedCustomer : c) })
  },

  deleteAddress: async (customerId, addrId) => {
    const { customers } = get()
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    const updatedCustomer: Customer = {
      ...customer,
      addresses: customer.addresses.filter(a => a.id !== addrId),
      updated_at: new Date().toISOString()
    }

    await (supabase.from('customers') as any).upsert(updatedCustomer)
    await upsertCustomerLocal(updatedCustomer)
    set({ customers: customers.map(c => c.id === customerId ? updatedCustomer : c) })
  },

  findByPhone: (phone) => {
    const normalizedPhone = phone.replace(/\D/g, '')
    return get().customers.find(c => c.phone.replace(/\D/g, '') === normalizedPhone)
  },

  search: (searchQuery) => {
    const q = searchQuery.toLowerCase()
    return get().customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    ).sort((a,b) => (b.order_count || 0) - (a.order_count || 0))
  },

  fetchPendingRequests: async () => {
    const { data, error } = await supabase
      .from('customer_change_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    set({ changeRequests: data as unknown as CustomerChangeRequest[] })
    return data as unknown as CustomerChangeRequest[]
  },

  createAddressChangeRequest: async (customerId, changeType, oldData, newData, orderId, requesterId, requesterName, newAddress, affectedAddressId) => {
    const customer = get().customers.find(c => c.id === customerId);
    
    const payload = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      customer_name: customer?.name || oldData.name || 'Unknown',
      change_type: changeType,
      old_data: oldData,
      requested_data: newData,
      order_id: orderId,
      requester_id: requesterId || 'system',
      requester_name: requesterName || 'System',
      status: 'pending',
      new_address: newAddress,
      affected_address_id: affectedAddressId,
      updated_at: new Date().toISOString()
    };

    const { error } = await (supabase.from('customer_change_requests') as any).insert(payload);

    if (error) {
      console.error('Failed to create address change request:', error);
      throw error;
    }
    
    set(state => ({ changeRequests: [payload as unknown as CustomerChangeRequest, ...state.changeRequests] }));
  },

  approveRequest: async (requestId, adminId, modifiedAddress) => {
    // 1. Get the request
    const { data: request, error: fetchErr } = await supabase
      .from('customer_change_requests')
      .select('*')
      .eq('id', requestId)
      .single() as { data: CustomerChangeRequest | null, error: any };
    
    if (fetchErr) throw fetchErr
    if (!request) throw new Error('Request not found');

    let finalRequestedData = request.requested_data as any;
    if (modifiedAddress && finalRequestedData.addresses) {
       if (request.change_type === 'address_add' && request.new_address) {
          const updatedAddresses = finalRequestedData.addresses.map((a: any) => 
             a.id === request.new_address!.id ? { ...a, address: modifiedAddress } : a
          );
          finalRequestedData = { ...finalRequestedData, addresses: updatedAddresses };
       } else if (request.change_type === 'address_edit' && request.affected_address_id) {
          const updatedAddresses = finalRequestedData.addresses.map((a: any) => 
             a.id === request.affected_address_id ? { ...a, address: modifiedAddress } : a
          );
          finalRequestedData = { ...finalRequestedData, addresses: updatedAddresses };
       }
    }
    
    // 2. Update customer data in DB
    const { error: updateCustErr } = await supabase
      .from('customers' as any)
      .upsert({
        ...finalRequestedData,
        id: request.customer_id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
    
    if (updateCustErr) throw updateCustErr

    // 2.5 Propagate changes to active orders
    if (request.change_type === 'address_edit' || request.change_type === 'address_add' || request.change_type === 'full_update') {
      let updatedAddress = '';
      if (request.change_type === 'address_add' && request.new_address) {
        updatedAddress = modifiedAddress || request.new_address.address;
      } else if (request.change_type === 'address_edit' && request.affected_address_id) {
        const addr = finalRequestedData.addresses?.find((a: any) => a.id === request.affected_address_id);
        updatedAddress = addr?.address || '';
      } else if (request.change_type === 'full_update') {
        const defaultAddr = finalRequestedData.addresses?.find((a: any) => a.is_default);
        updatedAddress = defaultAddr?.address || '';
        // Special case: if change was triggered from a specific order, it might not be the default one
        if (request.order_id && request.new_address) {
           updatedAddress = request.new_address.address;
        }
      }

      if (updatedAddress) {
        console.log(`[Sync] Propagating address update to active orders for phone: ${finalRequestedData.phone}`)
        await supabase
          .from('orders')
          .update({ 
            customer_address: updatedAddress, 
            customer_name: finalRequestedData.name,
            updated_at: new Date().toISOString()
          })
          .eq('customer_phone', finalRequestedData.phone)
          .in('status', ['assigned', 'picked_up', 'in_transit']);
      }
    }

    // 3. Update request status
    const { error: updateReqErr } = await (supabase
      .from('customer_change_requests' as any) as any)
      .update({
        status: 'approved',
        admin_id: adminId,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId as any)
    
    if (updateReqErr) throw updateReqErr

    // 4. Sync local state
    const { syncFromServer } = get()
    await syncFromServer()
    set(state => ({ changeRequests: state.changeRequests.filter(r => r.id !== requestId) }))
  },

  rejectRequest: async (requestId, adminId, notes) => {
    const { error } = await (supabase
      .from('customer_change_requests' as any) as any)
      .update({
        status: 'rejected',
        admin_id: adminId,
        admin_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId as any)
    
    if (error) throw error
    set(state => ({ changeRequests: state.changeRequests.filter(r => r.id !== requestId) }))
  },

  subscribeToRequests: () => {
    const channelName = 'customer_requests_all'
    
    // Increment reference count
    const currentRefs = channelRefs.get(channelName) || 0
    channelRefs.set(channelName, currentRefs + 1)

    if (activeChannels.has(channelName)) {
      console.log(`[Realtime] Reusing existing channel: ${channelName} (Refs: ${currentRefs + 1})`)
      return () => {
        const refs = channelRefs.get(channelName) || 1
        if (refs <= 1) {
          console.log(`[Realtime] Closing last listener for: ${channelName}`)
          activeChannels.get(channelName).unsubscribe()
          activeChannels.delete(channelName)
          channelStates.delete(channelName)
          channelRefs.delete(channelName)
          set(state => {
            const newStatus = { ...state.realtimeStatus }
            delete newStatus[channelName]
            return { realtimeStatus: newStatus }
          })
        } else {
          console.log(`[Realtime] Removing one listener from: ${channelName} (Remaining: ${refs - 1})`)
          channelRefs.set(channelName, refs - 1)
        }
      }
    }

    console.group(`[Realtime] New Subscription: ${channelName}`)
    console.log(`[Realtime] Table: customer_change_requests`)
    channelStates.set(channelName, 'joining')

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_change_requests' },
        (payload) => {
          console.log('[Realtime] EVENT [customer_change_requests]:', payload.eventType, payload.new)
          
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as CustomerChangeRequest
            set((state) => {
              // Prevent duplicates if fetch and realtime collide
              if (state.changeRequests.some(r => r.id === newItem.id)) return state;
              return { changeRequests: [newItem, ...state.changeRequests] };
            })
          } else if (payload.eventType === 'UPDATE') {
            set((state) => ({
              changeRequests: state.changeRequests.map(r => 
                r.id === payload.new.id ? (payload.new as CustomerChangeRequest) : r
              )
            }))
          } else if (payload.eventType === 'DELETE') {
            set((state) => ({
              changeRequests: state.changeRequests.filter(r => r.id !== payload.old.id)
            }))
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] Status [${channelName}]:`, status)
        if (err) console.error(`[Realtime] Error [${channelName}]:`, err)
        
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelName]: status } }))
        
        if (status === 'SUBSCRIBED') channelStates.set(channelName, 'joined')
        if (status === 'CHANNEL_ERROR') channelStates.set(channelName, 'errored')
        if (status === 'TIMED_OUT') channelStates.set(channelName, 'errored')
      })

    console.groupEnd()
    activeChannels.set(channelName, channel)

    return () => {
      const refs = channelRefs.get(channelName) || 1
      if (refs <= 1) {
        console.log(`[Realtime] Cleaning up root channel: ${channelName}`)
        channel.unsubscribe()
        activeChannels.delete(channelName)
        channelStates.delete(channelName)
        channelRefs.delete(channelName)
        set(state => {
          const newStatus = { ...state.realtimeStatus }
          delete newStatus[channelName]
          return { realtimeStatus: newStatus }
        })
      } else {
        console.log(`[Realtime] Removing one listener from: ${channelName} (Remaining: ${refs - 1})`)
        channelRefs.set(channelName, refs - 1)
      }
    }
  },

  subscribeToCustomers: () => {
    const channelName = 'customers_all'
    
    // Increment reference count
    const currentRefs = channelRefs.get(channelName) || 0
    channelRefs.set(channelName, currentRefs + 1)

    if (activeChannels.has(channelName)) {
      console.log(`[Realtime] Reusing existing channel: ${channelName} (Refs: ${currentRefs + 1})`)
      return () => {
        const refs = channelRefs.get(channelName) || 1
        if (refs <= 1) {
          console.log(`[Realtime] Closing last listener for: ${channelName}`)
          activeChannels.get(channelName).unsubscribe()
          activeChannels.delete(channelName)
          channelStates.delete(channelName)
          channelRefs.delete(channelName)
          set(state => {
            const newStatus = { ...state.realtimeStatus }
            delete newStatus[channelName]
            return { realtimeStatus: newStatus }
          })
        } else {
          console.log(`[Realtime] Removing one listener from: ${channelName} (Remaining: ${refs - 1})`)
          channelRefs.set(channelName, refs - 1)
        }
      }
    }

    console.group(`[Realtime] New Subscription: ${channelName}`)
    console.log(`[Realtime] Table: customers`)
    channelStates.set(channelName, 'joining')

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        async (payload) => {
          console.log('[Realtime] EVENT [customers]:', payload.eventType, payload.new)
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const customer = payload.new as Customer
            await upsertCustomerLocal(customer)
            
            set((state) => {
              const exists = state.customers.find(c => c.id === customer.id)
              if (exists) {
                return {
                  customers: state.customers.map(c => c.id === customer.id ? customer : c)
                }
              } else {
                return {
                  customers: [customer, ...state.customers]
                }
              }
            })
          } else if (payload.eventType === 'DELETE') {
            set((state) => ({
              customers: state.customers.filter(c => c.id !== payload.old.id)
            }))
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] Status [${channelName}]:`, status)
        if (err) console.error(`[Realtime] Error [${channelName}]:`, err)
        
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelName]: status } }))
        
        if (status === 'SUBSCRIBED') channelStates.set(channelName, 'joined')
        if (status === 'CHANNEL_ERROR') channelStates.set(channelName, 'errored')
        if (status === 'TIMED_OUT') channelStates.set(channelName, 'errored')
      })

    console.groupEnd()
    activeChannels.set(channelName, channel)

    return () => {
      const refs = channelRefs.get(channelName) || 1
      if (refs <= 1) {
        console.log(`[Realtime] Cleaning up root channel: ${channelName}`)
        channel.unsubscribe()
        activeChannels.delete(channelName)
        channelStates.delete(channelName)
        channelRefs.delete(channelName)
        set(state => {
          const newStatus = { ...state.realtimeStatus }
          delete newStatus[channelName]
          return { realtimeStatus: newStatus }
        })
      } else {
        console.log(`[Realtime] Removing one listener from: ${channelName} (Remaining: ${refs - 1})`)
        channelRefs.set(channelName, refs - 1)
      }
    }
  }
}))
