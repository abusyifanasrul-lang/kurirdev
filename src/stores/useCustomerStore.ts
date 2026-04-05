import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Customer, CustomerAddress, CustomerChangeRequest } from '@/types'
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
  
  // Admin Methods
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
          await upsertCustomerLocal(customer as Customer)
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

    const customer = upserted as Customer
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
    return data as CustomerChangeRequest[]
  },

  approveRequest: async (requestId, adminId) => {
    // 1. Get the request
    const { data: request, error: fetchErr } = await supabase
      .from('customer_change_requests')
      .select('*')
      .eq('id', requestId)
      .single() as { data: CustomerChangeRequest | null, error: any };
    
    if (fetchErr) throw fetchErr
    if (!request) throw new Error('Request not found');
    
    // 2. Update customer data in DB
    const { error: updateCustErr } = await supabase
      .from('customers' as any)
      .upsert({
        ...(request.requested_data as any),
        id: request.customer_id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
    
    if (updateCustErr) throw updateCustErr

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
  }
}))
