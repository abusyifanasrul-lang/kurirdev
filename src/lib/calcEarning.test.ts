import { describe, it, expect } from 'vitest'
import { calcCourierEarning, calcAdminEarning } from './calcEarning'
import type { Order } from '@/types'

describe('calcEarning Logic', () => {
  const defaultSettings = {
    commission_rate: 80, // Kurir dapat 80%
    commission_threshold: 10000, // Threshold 10rb
    commission_type: 'percentage' as const,
  }

  const flatSettings = {
    commission_rate: 80, 
    commission_threshold: 5000, // Threshold 5rb
    commission_type: 'flat' as const,
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

  describe('Percentage Model (Existing)', () => {
    it('should give 100% fee to courier if total_fee <= threshold', () => {
      const order = { ...baseOrder, total_fee: 10000 }
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(10000)
    })

    it('should give percentage fee to courier if total_fee > threshold', () => {
      const order = { ...baseOrder, total_fee: 20000 }
      const res = calcCourierEarning(order, defaultSettings)
      expect(res).toBe(16000)
    })
  })

  describe('Flat Range Model (New)', () => {
    it('should give 0 admin fee for ongkir <= threshold (5k)', () => {
      const order = { ...baseOrder, total_fee: 5000 }
      expect(calcAdminEarning(order, flatSettings)).toBe(0)
      expect(calcCourierEarning(order, flatSettings)).toBe(5000)
    })

    it('should give 1000 admin fee for 5001 - 19999 (when threshold is 5k)', () => {
      const order1 = { ...baseOrder, total_fee: 6000 }
      expect(calcAdminEarning(order1, flatSettings)).toBe(1000)
      expect(calcCourierEarning(order1, flatSettings)).toBe(5000)

      const order2 = { ...baseOrder, total_fee: 15000 }
      expect(calcAdminEarning(order2, flatSettings)).toBe(1000)
      expect(calcCourierEarning(order2, flatSettings)).toBe(14000)
    })

    it('should give 2000 admin fee for 20000 - 29999', () => {
      const order = { ...baseOrder, total_fee: 23000 }
      expect(calcAdminEarning(order, flatSettings)).toBe(2000)
    })

    it('should use custom threshold (e.g., 10k)', () => {
      const customSettings = { ...flatSettings, commission_threshold: 10000 }
      const order = { ...baseOrder, total_fee: 10000 }
      expect(calcAdminEarning(order, customSettings)).toBe(0)
      
      const order2 = { ...baseOrder, total_fee: 11000 }
      expect(calcAdminEarning(order2, customSettings)).toBe(1000)
    })

    it('should still handle extra courier fees correctly in flat mode', () => {
      const order = { 
        ...baseOrder, 
        total_fee: 15000, 
        total_biaya_titik: 3000, 
        total_biaya_beban: 2000 
      }
      // total_fee 15k admin share 1k -> courier base 14k
      // 14k + 3k + 2k = 19k
      const res = calcCourierEarning(order, flatSettings)
      expect(res).toBe(19000)
    })
  })
})
