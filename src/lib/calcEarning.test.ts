import { describe, it, expect } from 'vitest'
import { calcCourierEarning, calcAdminEarning } from './calcEarning'
import type { Order } from '@/types'

describe('calcEarning Logic', () => {
  const defaultSettings = {
    commission_rate: 80, // Kurir dapat 80%
    commission_threshold: 10000, // Threshold 10rb
  }

  const baseOrder: Order = {
    id: '1',
    order_number: 'P010126001',
    customer_name: 'Test Customer',
    customer_phone: '08123456789',
    customer_address: 'Test Address',
    status: 'pending',
    total_fee: 15000,
    payment_status: 'unpaid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  describe('calcCourierEarning', () => {
    it('should give 100% fee to courier if total_fee <= threshold', () => {
      const order = { ...baseOrder, total_fee: 10000 }
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(10000)
    })

    it('should give percentage fee to courier if total_fee > threshold', () => {
      const order = { ...baseOrder, total_fee: 20000 }
      // 20000 * 80% = 16000
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(16000)
    })

    it('should prioritize applied_commission_rate from order snapshot', () => {
      const order = { ...baseOrder, total_fee: 20000, applied_commission_rate: 70 }
      // 20000 * 70% = 14000
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(14000)
    })

    it('should prioritize applied_commission_threshold from order snapshot', () => {
      const order = { ...baseOrder, total_fee: 15000, applied_commission_threshold: 20000 }
      // total_fee (15k) <= threshold (20k) => 100% = 15000
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(15000)
    })

    it('should add extraTitik and extraBeban to the total', () => {
      const order = { 
        ...baseOrder, 
        total_fee: 20000, 
        total_biaya_titik: 3000, 
        total_biaya_beban: 2000 
      }
      // (20000 * 80%) + 3000 + 2000 = 16000 + 5000 = 21000
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(21000)
    })

    it('should handle zero extra fees properly', () => {
      const order = { ...baseOrder, total_fee: 20000 }
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(16000)
    })
  })

  describe('calcAdminEarning', () => {
    it('should return 0 if total_fee <= threshold', () => {
      const order = { ...baseOrder, total_fee: 10000 }
      const res = calcAdminEarning(order, defaultSettings)
      expect(res).toBe(0)
    })

    it('should return remaining percentage if total_fee > threshold', () => {
      const order = { ...baseOrder, total_fee: 20000 }
      // 20000 * (100% - 80%) = 20000 * 20% = 4000
      const res = calcAdminEarning(order, defaultSettings)
      expect(res).toBe(4000)
    })

    it('should prioritize snapshot rate and threshold', () => {
      const order = { 
        ...baseOrder, 
        total_fee: 30000, 
        applied_commission_rate: 60,
        applied_commission_threshold: 5000 
      }
      // 30000 * (100% - 60%) = 30000 * 40% = 12000
      const res = calcAdminEarning(order, defaultSettings)
      expect(res).toBe(12000)
    })

    it('should not include extra courier fees in admin earning', () => {
      const order = { 
        ...baseOrder, 
        total_fee: 20000, 
        total_biaya_titik: 5000, 
        total_biaya_beban: 3000 
      }
      // 20000 * 20% = 4000 (extra fees only for courier)
      const res = calcAdminEarning(order, defaultSettings)
      expect(res).toBe(4000)
    })
  })
})
