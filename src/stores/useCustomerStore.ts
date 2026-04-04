import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Customer, CustomerAddress, CustomerChangeRequest } from '@/types'
import { useSessionStore } from '@/stores/useSessionStore'
import { Database, Json } from '@/types/supabase'
import { getAllCustomersLocal, upsertCustomerLocal, saveCustomerSyncTime, getCustomerSyncTime } from '@/lib/orderCache'

interface CustomerState {
  customers: Customer[]
  isLoaded: boolean

  loadFromLocal: () => Promise<void>
  syncFromServer: () => Promise<void>
  upsertCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer>
  addAddress: (customerId: string, addr: Omit<CustomerAddress, 'id'>) => Promise<void>
  updateAddress: (customerId: string, addrId: string, data: Partial<CustomerAddress>) => Promise<void>
  deleteAddress: (customerId: string, addrId: string) => Promise<void>

  findByPhone: (phone: string) => Customer | undefined
  search: (searchQuery: string) => Customer[]

  // Change Request Methods
  submitChangeRequest: (customerId: string, requesterId: string, oldData: Partial<Customer>, requestedData: Partial<Customer>, orderId?: string) => Promise<void>
  fetchPendingRequests: () => Promise<CustomerChangeRequest[]>
  approveRequest: (requestId: string, adminId: string) => Promise<void>
  rejectRequest: (requestId: string, adminId: string, notes: string) => Promise<void>
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  isLoaded: false,

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
    } catch (error: unknown) {
      console.error('Error syncing customers:', error)
    }
  },

  upsertCustomer: async (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    const { customers } = get()
    const { user } = useSessionStore.getState()
    const isCourier = user?.role === 'courier'
    
    // Normalize phone for comparison
    const normalizedPhone = data.phone.replace(/\D/g, '')
    const existing = customers.find(c => c.phone.replace(/\D/g, '') === normalizedPhone)

    // 1. If it's a courier editing an EXISTING customer -> Must follow approval flow
    if (isCourier && existing && user) {
      const requestedData: Partial<Customer> = {
        name: data.name,
        phone: data.phone,
        addresses: data.addresses,
        updated_at: new Date().toISOString()
      }
      
      await get().submitChangeRequest(
        existing.id, 
        user.id, 
        existing, 
        requestedData
      )
      
      // Return existing for immediate UI feedback without changing DB yet
      return existing
    }

    // 2. Direct Upsert (for Admins or NEW customers created by couriers)
    const { data: upserted, error } = await supabase
      .from('customers')
      .upsert({
        name: data.name,
        phone: data.phone,
        addresses: data.addresses as unknown as Json,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })
      .select()
      .single()

    if (error) throw error

    const customer = (upserted as unknown as Customer)
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
    const { user } = useSessionStore.getState()
    const customer = customers.find(c => c.id === customerId)
    if (!customer || !user) return

    const newAddress: CustomerAddress = { ...addr, id: crypto.randomUUID() }
    const requestedData: Customer = {
      ...customer,
      addresses: [...customer.addresses, newAddress],
      updated_at: new Date().toISOString()
    }

    if (user.role === 'courier') {
      await get().submitChangeRequest(customerId, user.id, customer, requestedData, undefined)
    } else {
      await supabase.from('customers').upsert(requestedData as unknown as Database['public']['Tables']['customers']['Insert'])
      await upsertCustomerLocal(requestedData)
      set({ customers: customers.map(c => c.id === customerId ? requestedData : c) })
    }
  },

  updateAddress: async (customerId, addrId, data) => {
    const { customers } = get()
    const { user } = useSessionStore.getState()
    const customer = customers.find(c => c.id === customerId)
    if (!customer || !user) return

    const updatedCustomer: Customer = {
      ...customer,
      addresses: customer.addresses.map(a => a.id === addrId ? { ...a, ...data } : a),
      updated_at: new Date().toISOString()
    }

    if (user.role === 'courier') {
      await get().submitChangeRequest(customerId, user.id, customer, updatedCustomer)
    } else {
      await supabase.from('customers').upsert(updatedCustomer as unknown as Database['public']['Tables']['customers']['Insert'])
      await upsertCustomerLocal(updatedCustomer)
      set({ customers: customers.map(c => c.id === customerId ? updatedCustomer : c) })
    }
  },

  deleteAddress: async (customerId, addrId) => {
    const { customers } = get()
    const { user } = useSessionStore.getState()
    const customer = customers.find(c => c.id === customerId)
    if (!customer || !user) return

    const updatedCustomer: Customer = {
      ...customer,
      addresses: customer.addresses.filter(a => a.id !== addrId),
      updated_at: new Date().toISOString()
    }

    if (user.role === 'courier') {
      await get().submitChangeRequest(customerId, user.id, customer, updatedCustomer)
    } else {
      await supabase.from('customers').upsert(updatedCustomer as unknown as Database['public']['Tables']['customers']['Insert'])
      await upsertCustomerLocal(updatedCustomer)
      set({ customers: customers.map(c => c.id === customerId ? updatedCustomer : c) })
    }
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

  submitChangeRequest: async (customerId: string, requesterId: string, oldData: Partial<Customer>, requestedData: Partial<Customer>, orderId?: string) => {
    const { error } = await supabase
      .from('customer_change_requests')
      .insert({
        customer_id: customerId,
        requester_id: requesterId,
        order_id: orderId,
        old_data: oldData as unknown as Json,
        requested_data: requestedData as unknown as Json,
        status: 'pending'
      })

    if (error) throw error
  },

  fetchPendingRequests: async () => {
    const { data, error } = await supabase
      .from('customer_change_requests')
      .select(`
        *,
        customers(name),
        profiles:requester_id(name),
        orders:order_id(order_number)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    return (data || []).map(item => ({
      ...item,
      customer_name: (item as any).customers?.name,
      requester_name: (item as any).profiles?.name,
      order_number: (item as any).orders?.order_number
    })) as CustomerChangeRequest[]
  },

  approveRequest: async (requestId, adminId) => {
    // 1. Get the request data
    const { data: request, error: fetchErr } = await supabase
      .from('customer_change_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchErr) throw fetchErr

    // 2. Update the customer record
    const { error: updateCustErr } = await supabase
      .from('customers')
      .update(request.requested_data as unknown as Database['public']['Tables']['customers']['Update'])
      .eq('id', (request.customer_id as string))

    if (updateCustErr) throw updateCustErr

    // 3. Mark request as approved
    const { error: approveErr } = await supabase
      .from('customer_change_requests')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (approveErr) throw approveErr

    // 4. Sync local store
    await get().syncFromServer()
  },

  rejectRequest: async (requestId, adminId, notes) => {
    const { error } = await supabase
      .from('customer_change_requests')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_notes: notes
      })
      .eq('id', requestId)

    if (error) throw error
  }
}))
