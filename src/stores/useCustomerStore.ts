import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Customer, CustomerAddress, CustomerChangeRequest } from '@/types'
import { getAllCustomersLocal, upsertCustomerLocal, saveCustomerSyncTime, getCustomerSyncTime } from '@/lib/orderCache'

let customerResyncTime = 0
const customerChannels = new Map<string, RealtimeChannel>()
const customerStates = new Map<string, string>()
const customerRefs = new Map<string, number>()

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
  // Internal lock for resync operations (helps with HMR stability)
  _resyncLock: Promise<void> | null
  subscribeToRequests: () => Promise<(() => void) | void>
  subscribeToCustomers: () => Promise<(() => void) | void>
  resyncRealtime: (options?: { force?: boolean }) => Promise<void>
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  changeRequests: [],
  isLoaded: false,
  realtimeStatus: {},
  _resyncLock: null,

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
    
    const { error: updateCustErr } = await supabase
      .from('customers' as any)
      .upsert({
        ...finalRequestedData,
        id: request.customer_id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
    
    if (updateCustErr) throw updateCustErr

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
        if (request.order_id && request.new_address) {
           updatedAddress = request.new_address.address;
        }
      }

      if (updatedAddress) {
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

    const { error: updateReqErr } = await (supabase
      .from('customer_change_requests' as any) as any)
      .update({
        status: 'approved',
        admin_id: adminId,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId as any)
    
    if (updateReqErr) throw updateReqErr

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

  subscribeToRequests: async () => {
    const channelId = 'customer_requests_all'
    
    const currentRef = customerRefs.get(channelId) || 0
    customerRefs.set(channelId, currentRef + 1)

    const existing = customerChannels.get(channelId)
    if (existing && customerStates.get(channelId) === 'joined') {
      return () => get().unsubscribeFromRequests()
    }

    if (existing) {
      console.log(`♻️ Cleaning up existing customer requests channel...`)
      await supabase.removeChannel(existing)
      customerChannels.delete(channelId)
    }

    console.log(`📡 Joining customer requests channel: ${channelId}`)
    customerStates.set(channelId, 'joining')

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_change_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as CustomerChangeRequest
            set((state) => {
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          customerStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          customerStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          customerChannels.delete(channelId)
        }
      })

    customerChannels.set(channelId, channel)

    return () => get().unsubscribeFromRequests()
  },

  unsubscribeFromRequests: () => {
    const channelId = 'customer_requests_all'
    const currentRef = customerRefs.get(channelId) || 0
    
    if (currentRef <= 1) {
      const channel = customerChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel)
        customerChannels.delete(channelId)
        customerStates.delete(channelId)
      }
      customerRefs.set(channelId, 0)
    } else {
      customerRefs.set(channelId, currentRef - 1)
    }
  },

  subscribeToCustomers: async () => {
    const channelId = 'customers_all'
    
    const currentRef = customerRefs.get(channelId) || 0
    customerRefs.set(channelId, currentRef + 1)

    const existing = customerChannels.get(channelId)
    if (existing && customerStates.get(channelId) === 'joined') {
      return () => get().unsubscribeFromCustomers()
    }

    if (existing) {
      console.log(`♻️ Cleaning up existing customers channel...`)
      await supabase.removeChannel(existing)
      customerChannels.delete(channelId)
    }

    console.log(`📡 Joining customers channel: ${channelId}`)
    customerStates.set(channelId, 'joining')

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        async (payload) => {
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          customerStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          customerStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          customerChannels.delete(channelId)
        }
      })

    customerChannels.set(channelId, channel)

    return () => get().unsubscribeFromCustomers()
  },

  unsubscribeFromCustomers: () => {
    const channelId = 'customers_all'
    const currentRef = customerRefs.get(channelId) || 0
    
    if (currentRef <= 1) {
      const channel = customerChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel)
        customerChannels.delete(channelId)
        customerStates.delete(channelId)
      }
      customerRefs.set(channelId, 0)
    } else {
      customerRefs.set(channelId, currentRef - 1)
    }
  },

  resyncRealtime: async (options) => {
    // 1. Operation Lock: Prevent parallel resyncs (HMR friendly)
    if (get()._resyncLock) {
      console.log('⏳ Customer store resync already in progress, skipping duplicate call.')
      return get()._resyncLock as Promise<void>
    }

    const resyncPromise = (async () => {
      try {
        const now = Date.now()
        if (!options?.force && (now - customerResyncTime < 30000)) return
        customerResyncTime = now

        if (options?.force) {
          console.log('🔄 Forced customers resync triggered...')
        } else {
          console.log('🔄 Throttled customers resync triggered...')
        }
        
        await get().syncFromServer()
        
        const channels = ['customer_requests_all', 'customers_all']
        for (const channelName of channels) {
          const channelState = customerStates.get(channelName)
          if (channelState === 'errored' || channelState === 'closed' || !customerChannels.has(channelName)) {
            console.warn(`⚠️ [CustomerStore] Connection dead for ${channelName} (${channelState})...`)
            if (channelName === 'customer_requests_all') await get().subscribeToRequests()
            else await get().subscribeToCustomers()
          }
        }
      } finally {
        set({ _resyncLock: null })
      }
    })()

    set({ _resyncLock: resyncPromise })
    return resyncPromise
  }
}))
