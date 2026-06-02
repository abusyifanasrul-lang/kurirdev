/**
 * Courier Queue Utilities
 * 
 * Centralized logic for courier queue management and tier-based sorting.
 * Used by Dashboard and Orders pages for consistent behavior.
 */

import type { Order } from '@/types';

export interface CourierUser {
  id: string;
  name: string;
  role: string;
  is_active: boolean | null;
  is_online: boolean | null;
  is_priority_recovery: boolean | null;
  courier_status: string | null;
  queue_joined_at: string | null;
  vehicle_type?: string | null;
  out_of_shift?: boolean | null;
}

/**
 * Calculate priority tier for a courier (1-6, lower = higher priority)
 * 
 * Tier 1: Cancel boost (is_priority_recovery)
 * Tier 2: STAY at basecamp (idle or pending only)
 * Tier 3: ON and idle (no orders)
 * Tier 4: ON with ALL orders waiting (is_waiting = true)
 * Tier 5: ON with active running orders
 * Tier 6: Fallback
 */
export function getCourierTier(
  courier: CourierUser,
  activeOrders: Order[]
): number {
  // Tier 1: Cancel boost always wins
  if (courier.is_priority_recovery) return 1;
  
  // Count active orders for this courier
  const courierActiveOrders = activeOrders.filter(o => 
    o.courier_id === courier.id && 
    !['cancelled', 'delivered'].includes(o.status || '')
  );
  
  const hasRunningOrder = courierActiveOrders.some(o => 
    ['picked_up', 'in_transit'].includes(o.status || '')
  );
  
  // Tier 2: STAY at basecamp (but not if actively delivering)
  if (courier.courier_status === 'stay') {
    // STAY + actively delivering = Tier 5 (courier left basecamp, GPS lag)
    if (hasRunningOrder) return 5;
    // STAY + idle or pending = Tier 2 (physically at basecamp)
    return 2;
  }
  
  // Tier 3: ON and idle
  if (courier.courier_status === 'on' && courierActiveOrders.length === 0) {
    return 3;
  }
  
  // Tier 4: ON with ALL orders waiting (is_waiting flag = true)
  const waitingOnly = courierActiveOrders.length > 0 && 
    courierActiveOrders.every(o => o.is_waiting === true);
  if (courier.courier_status === 'on' && waitingOnly) {
    return 4;
  }
  
  // Tier 5: ON with active running orders
  if (courier.courier_status === 'on') return 5;
  
  // Tier 6: Default fallback
  return 6;
}

/**
 * Sub-tier sorting for Tier 2 (STAY) couriers
 * 
 * Returns negative if courierA should come first, positive if courierB should come first
 */
export function compareStaySubTier(
  courierA: CourierUser,
  courierB: CourierUser,
  activeOrders: Order[]
): number {
  const activeOrdersA = activeOrders.filter(o => 
    o.courier_id === courierA.id && 
    !['cancelled', 'delivered'].includes(o.status || '')
  );
  const activeOrdersB = activeOrders.filter(o => 
    o.courier_id === courierB.id && 
    !['cancelled', 'delivered'].includes(o.status || '')
  );
  
  // 1. Fewer orders = higher priority
  if (activeOrdersA.length !== activeOrdersB.length) {
    return activeOrdersA.length - activeOrdersB.length;
  }
  
  // 2. If same count, waiting orders = higher priority
  if (activeOrdersA.length > 0) {
    const waitingOnlyA = activeOrdersA.every(o => o.is_waiting === true);
    const waitingOnlyB = activeOrdersB.every(o => o.is_waiting === true);
    if (waitingOnlyA !== waitingOnlyB) return waitingOnlyA ? -1 : 1;
  }
  
  return 0; // Equal sub-tier
}

/**
 * Compare two couriers by queue_joined_at (FIFO)
 * 
 * Returns negative if courierA joined earlier, positive if courierB joined earlier
 */
export function compareFIFO(
  courierA: CourierUser,
  courierB: CourierUser
): number {
  const timeA = courierA.queue_joined_at 
    ? new Date(courierA.queue_joined_at).getTime() 
    : Infinity;
  const timeB = courierB.queue_joined_at 
    ? new Date(courierB.queue_joined_at).getTime() 
    : Infinity;
  
  return timeA - timeB;
}

/**
 * Sort couriers for normal queue (not out-of-shift)
 * 
 * Sorting order:
 * 1. By tier (lower tier = higher priority)
 * 2. Sub-tier for Tier 2 (STAY): fewer orders first
 * 3. FIFO (queue_joined_at)
 * 4. Deterministic tiebreaker (ID)
 */
export function sortNormalQueue(
  couriers: CourierUser[],
  activeOrders: Order[]
): CourierUser[] {
  return [...couriers].sort((a, b) => {
    const tierA = getCourierTier(a, activeOrders);
    const tierB = getCourierTier(b, activeOrders);
    
    // Primary sort: By tier
    if (tierA !== tierB) return tierA - tierB;
    
    // Sub-tier sorting for Tier 2 (STAY): workload-based
    if (tierA === 2 && tierB === 2) {
      const subTierResult = compareStaySubTier(a, b, activeOrders);
      if (subTierResult !== 0) return subTierResult;
    }
    
    // FIFO for same tier + same workload
    const fifoResult = compareFIFO(a, b);
    if (fifoResult !== 0) return fifoResult;
    
    // Tertiary sort: ID (Deterministic tiebreaker)
    return a.id.localeCompare(b.id);
  });
}

/**
 * Sort couriers for private mode queue (out-of-shift)
 * 
 * Sorting order:
 * 1. FIFO (queue_joined_at)
 * 2. Name (deterministic tiebreaker)
 */
export function sortPrivateQueue(
  couriers: CourierUser[]
): CourierUser[] {
  return [...couriers].sort((a, b) => {
    // FIFO sorting
    const fifoResult = compareFIFO(a, b);
    if (fifoResult !== 0) return fifoResult;
    
    // Fallback: Sort by name for deterministic ordering
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter and sort available couriers for normal queue
 * 
 * Filters: active, online, NOT out-of-shift
 * Sorted by tier logic
 */
export function getAvailableCouriers(
  users: CourierUser[],
  activeOrders: Order[]
): CourierUser[] {
  const courierList = users.filter(u => 
    u.role === 'courier' && 
    u.is_active === true && 
    u.is_online === true &&
    !(u as any).out_of_shift  // Exclude private order mode couriers
  );
  
  return sortNormalQueue(courierList, activeOrders);
}

/**
 * Filter and sort private mode couriers (out-of-shift)
 * 
 * Filters: active, online, out-of-shift = true
 * Sorted by FIFO
 */
export function getPrivateModeCouriers(
  users: CourierUser[]
): CourierUser[] {
  const courierList = users.filter(u =>
    u.role === 'courier' &&
    u.is_active === true &&
    u.is_online === true &&
    (u as any).out_of_shift === true  // Only private order mode
  );
  
  return sortPrivateQueue(courierList);
}
