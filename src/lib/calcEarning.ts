import type { Order } from '@/types'

interface EarningSettings {
  commission_rate: number
  commission_threshold: number
}

export const calcCourierEarning = (order: Order, settings: EarningSettings): number => {
  const rate = settings.commission_rate / 100
  const ongkirKurir = order.total_fee <= settings.commission_threshold
    ? order.total_fee
    : order.total_fee * rate
  return ongkirKurir + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)
}

export const calcAdminEarning = (order: Order, settings: EarningSettings): number => {
  if (order.total_fee <= settings.commission_threshold) return 0
  return order.total_fee * (1 - settings.commission_rate / 100)
}
