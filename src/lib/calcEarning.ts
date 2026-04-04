import type { Order } from '@/types'

interface EarningSettings {
  commission_rate: number
  commission_threshold: number
}

export const calcCourierEarning = (order: Order, settings: EarningSettings): number => {
  const effectiveRate = (order.applied_commission_rate ?? settings.commission_rate) / 100
  const effectiveThreshold = order.applied_commission_threshold ?? settings.commission_threshold
  const ongkirKurir = order.total_fee <= effectiveThreshold
    ? order.total_fee
    : order.total_fee * effectiveRate
  return ongkirKurir + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)
}

export const calcAdminEarning = (order: Order, settings: EarningSettings): number => {
  const effectiveRate = (order.applied_commission_rate ?? settings.commission_rate) / 100
  const effectiveThreshold = order.applied_commission_threshold ?? settings.commission_threshold
  if (order.total_fee <= effectiveThreshold) return 0
  return Math.round(order.total_fee * (1 - effectiveRate))
}
