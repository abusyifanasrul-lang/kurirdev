import { describe, it, expect } from 'vitest'
import { formatCurrency } from './formatter'

describe('formatter Utilities', () => {
  describe('formatCurrency', () => {
    it('should format positive values to IDR', () => {
      // id-ID format for IDR: Rp 10.000 (usually has a non-breaking space)
      const res = formatCurrency(10000).replace(/\u00a0/g, ' ')
      expect(res).toBe('Rp 10.000')
    })

    it('should format zero value correctly', () => {
      const res = formatCurrency(0).replace(/\u00a0/g, ' ')
      expect(res).toBe('Rp 0')
    })

    it('should format negative values correctly', () => {
      const res = formatCurrency(-5000).replace(/\u00a0/g, ' ')
      // Note: Intl format for negative IDR is usually -Rp 5.000
      expect(res).toMatch(/-Rp 5.000|Rp -5.000/)
    })

    it('should handle large numbers', () => {
      const res = formatCurrency(1234567).replace(/\u00a0/g, ' ')
      expect(res).toBe('Rp 1.234.567')
    })
  })
})
