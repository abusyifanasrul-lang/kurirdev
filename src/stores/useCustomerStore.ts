import { create } from 'zustand'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import { Customer, CustomerAddress } from '@/types'
import { getAllCustomersLocal, upsertCustomerLocal, saveCustomerSyncTime, getCustomerSyncTime } from '@/lib/orderCache'

interface CustomerState {
  customers: Customer[]
  isLoaded: boolean

  loadFromLocal: () => Promise<void>
  syncFromFirestore: () => Promise<void>
  upsertCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer>
  addAddress: (customerId: string, addr: Omit<CustomerAddress, 'id'>) => Promise<void>
  updateAddress: (customerId: string, addrId: string, data: Partial<CustomerAddress>) => Promise<void>
  deleteAddress: (customerId: string, addrId: string) => Promise<void>

  findByPhone: (phone: string) => Customer | undefined
  search: (searchQuery: string) => Customer[]
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

  syncFromFirestore: async () => {
    const lastSync = getCustomerSyncTime()
    try {
      let q = query(collection(db, 'customers'));
      if (lastSync) {
        q = query(collection(db, 'customers'), where('updated_at', '>', lastSync));
      }
      
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const fetched = snapshot.docs.map(doc => doc.data() as Customer)
        
        for (const customer of fetched) {
          await upsertCustomerLocal(customer)
        }

        const localCustomers = await getAllCustomersLocal()
        set({ customers: localCustomers })
      }
      saveCustomerSyncTime()
    } catch (error) {
      console.error('Error syncing customers:', error)
    }
  },

  upsertCustomer: async (data) => {
    const { customers } = get()
    // Normalisasi phone
    const normalizedPhone = data.phone.replace(/\D/g, '')
    const existing = customers.find(c => c.phone.replace(/\D/g, '') === normalizedPhone)
    
    if (!existing) {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        name: data.name,
        phone: data.phone,
        addresses: data.addresses,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await setDoc(doc(db, 'customers', newCustomer.id), newCustomer)
      await upsertCustomerLocal(newCustomer)
      set({ customers: [...customers, newCustomer] })
      return newCustomer
    } else {
      const updatedCustomer: Customer = {
        ...existing,
        name: data.name,
        addresses: data.addresses,
        updated_at: new Date().toISOString()
      }
      await setDoc(doc(db, 'customers', updatedCustomer.id), updatedCustomer)
      await upsertCustomerLocal(updatedCustomer)
      set({ customers: customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c) })
      return updatedCustomer
    }
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

    await setDoc(doc(db, 'customers', customerId), updatedCustomer)
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

    await setDoc(doc(db, 'customers', customerId), updatedCustomer)
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

    await setDoc(doc(db, 'customers', customerId), updatedCustomer)
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
  }
}))
