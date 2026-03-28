import { db } from '@/lib/firebase'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { Customer } from '@/types'

export async function runCustomerMigration() {
  try {
    console.log('Fetching orders for migration...')
    const orderSnapshot = await getDocs(collection(db, 'orders'))
    const orders = orderSnapshot.docs.map(doc => doc.data())

    console.log(`Found ${orders.length} orders. Processing...`)
    
    const customersMap = new Map<string, Customer>()

    for (const order of orders) {
      if (!order.customer_phone || !order.customer_name) continue

      const rawPhone = order.customer_phone.replace(/\D/g, '')
      if (rawPhone.length < 5) continue

      if (!customersMap.has(rawPhone)) {
        customersMap.set(rawPhone, {
          id: crypto.randomUUID(),
          name: order.customer_name,
          phone: order.customer_phone,
          addresses: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          order_count: 0,
        })
      }

      const customer = customersMap.get(rawPhone)!
      customer.order_count = (customer.order_count || 0) + 1

      const addrExists = customer.addresses.find(
        a => a.address.toLowerCase().trim() === (order.customer_address || '').toLowerCase().trim()
      )

      if (!addrExists && order.customer_address) {
        customer.addresses.push({
          id: crypto.randomUUID(),
          label: `Alamat ${customer.addresses.length + 1}`,
          address: order.customer_address,
          is_default: customer.addresses.length === 0,
          notes: ''
        })
      }
    }

    const uniqueCustomers = Array.from(customersMap.values())
    console.log(`Generating ${uniqueCustomers.length} unique customers.`)

    const BATCH_SIZE = 450
    let batchCount = 0

    for (let i = 0; i < uniqueCustomers.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      const chunk = uniqueCustomers.slice(i, i + BATCH_SIZE)
      
      for (const customer of chunk) {
        const ref = doc(db, 'customers', customer.id)
        batch.set(ref, customer)
      }

      await batch.commit()
      batchCount++
      console.log(`Committed batch ${batchCount}`)
    }

    console.log('Migration completed successfully!')
    return { success: true, count: uniqueCustomers.length }

  } catch (error: any) {
    console.error('Migration failed:', error)
    return { success: false, error: error.message }
  }
}
