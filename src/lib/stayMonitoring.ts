import { supabase } from './supabaseClient';
import { useUserStore } from '@/stores/useUserStore';
import { StayUpdateResult } from '@/types';

/**
 * Calculates distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates courier presence in basecamp and updates counter in database.
 * Phase 1: Manual/Scheduled trigger from UI components.
 */
export async function checkStayPresence(
  courierId: string,
  currentLat: number,
  currentLng: number,
  accuracy: number | null = null
): Promise<StayUpdateResult> {
  const user = useUserStore.getState().users.find(u => u.id === courierId);
  
  if (!user || user.courier_status !== 'stay' || !user.current_basecamp_id) {
    return { 
      status_changed: false, 
      new_status: user?.courier_status || 'off', 
      counter: user?.stay_zone_counter || 0 
    };
  }

  // 1. Fetch basecamp config
  // Note: In production, this should ideally be cached in a store to avoid frequent DB hits
  const { data: basecamp, error: bcError } = await supabase
    .from('basecamps')
    .select('lat, lng, stay_radius_meters')
    .eq('id', user.current_basecamp_id)
    .single();

  if (bcError || !basecamp) {
    throw new Error('Basecamp tidak ditemukan atau tidak aktif');
  }

  // 2. Local distance check (pre-validation)
  const distance = calculateDistance(currentLat, currentLng, Number(basecamp.lat), Number(basecamp.lng));
  const inZone = distance <= basecamp.stay_radius_meters;

  // 3. Update counter in DB via RPC
  const { data, error: rpcError } = await supabase.rpc('update_stay_counter', {
    p_courier_id: courierId,
    p_in_zone: inZone,
    p_distance: distance,
    p_accuracy: accuracy
  });

  if (rpcError) throw rpcError;

  // result is an array of objects from RETURNS TABLE
  const result = (data as any)[0] as StayUpdateResult;
  
  // 4. Sync profile if status changed (e.g. auto-revoked to 'on')
  if (result.status_changed) {
    await useUserStore.getState().fetchProfile(courierId);
  }

  return result;
}