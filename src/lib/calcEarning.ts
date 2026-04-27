import type { Order } from '@/types'

export type CommissionType = 'percentage' | 'flat'

interface EarningSettings {
  commission_rate: number
  commission_threshold: number
  commission_type?: CommissionType
}

/**
 * Calculates the admin share (fee) from the delivery fee.
 * Logic based on settings.commission_type.
 */
export const calculateAdminFee = (totalFee: number, settings: EarningSettings): number => {
  if (settings.commission_type === 'flat') {
    // Flat Range Model:
    // - <= threshold: 0
    // - > threshold: min 1000, or based on the tens digit (60k -> 6k)
    if (totalFee <= settings.commission_threshold) return 0
    return Math.max(1000, Math.floor(totalFee / 10000) * 1000)
  }

  // Default Percentage Model
  // If totalFee <= threshold, admin gets 0
  if (totalFee <= settings.commission_threshold) return 0
  
  // Commission rate defines COURIER share (e.g. 80), so admin gets 100% - 80%
  const adminRate = 1 - (settings.commission_rate / 100)
  return Math.round(totalFee * adminRate)
}

export const calcCourierEarning = (order: Order, settings: EarningSettings): number => {
  const adminFee = calculateAdminFee(order.total_fee, settings)
  const courierBaseShare = order.total_fee - adminFee
  const fine = (order as any).fine_deducted || 0
  
  return Math.max(0, courierBaseShare - fine) + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)
}

export const calcAdminEarning = (order: Order, settings: EarningSettings): number => {
  const adminFee = calculateAdminFee(order.total_fee, settings)
  const fine = (order as any).fine_deducted || 0
  return adminFee + fine
}
