// Offline-First Storage untuk Critical Delivery Data
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { useState, useEffect } from 'react';

interface DeliveryDB extends DBSchema {
  // Critical data yang harus available offline
  orders: {
    key: number;
    value: {
      id: number;
      order_number: string;
      customer_name: string;
      customer_phone: string;
      customer_address: string;
      status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
      total_fee: number;
      courier_id?: number;
      assigned_at?: string;
      picked_up_at?: string;
      delivered_at?: string;
      created_at: string;
      updated_at: string;
      // Offline metadata
      last_sync: string;
      is_dirty: boolean;
      sync_version: number;
    };
    indexes: {
      'by-status': 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
      'by-courier': number;
      'by-sync': string;
      'by-date': string;
    };
  };
  
  // Queue untuk offline actions
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      endpoint: string;
      method: 'POST' | 'PUT' | 'DELETE';
      data: any;
      timestamp: number;
      retry_count: number;
      last_attempt?: number;
    };
    indexes: {
      'by-timestamp': number;
      'by-retry': number;
    };
  };

  // Courier profile & status
  courier_profile: {
    key: number;
    value: {
      id: number;
      name: string;
      email: string;
      phone: string;
      is_online: boolean;
      current_location?: {
        lat: number;
        lng: number;
        timestamp: number;
      };
      last_sync: string;
      is_dirty: boolean;
    };
  };

  // Cached API responses
  api_cache: {
    key: string;
    value: {
      url: string;
      data: any;
      timestamp: number;
      expires_at: number;
      etag?: string;
    };
    indexes: {
      'by-expires': number;
    };
  };

  // App settings & preferences
  settings: {
    key: string;
    value: {
      key: string;
      value: any;
      updated_at: string;
    };
  };
}

class OfflineStorage {
  private db: IDBPDatabase<DeliveryDB> | null = null;
  private readonly DB_NAME = 'delivery-pro-db';
  private readonly DB_VERSION = 1;

  async init() {
    try {
      this.db = await openDB<DeliveryDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db: IDBPDatabase<DeliveryDB>) {
          // Orders store
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
          ordersStore.createIndex('by-status', 'status');
          ordersStore.createIndex('by-courier', 'courier_id');
          ordersStore.createIndex('by-sync', 'last_sync');
          ordersStore.createIndex('by-date', 'created_at');

          // Sync queue store
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('by-timestamp', 'timestamp');
          syncStore.createIndex('by-retry', 'retry_count');

          // Courier profile store
          db.createObjectStore('courier_profile', { keyPath: 'id' });

          // API cache store
          const cacheStore = db.createObjectStore('api_cache', { keyPath: 'url' });
          cacheStore.createIndex('by-expires', 'expires_at');

          // Settings store
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      });

      console.log('[OfflineStorage] Database initialized');
      return this.db;
    } catch (error) {
      console.error('[OfflineStorage] Failed to initialize database:', error);
      throw error;
    }
  }

  // Orders management
  async saveOrders(orders: any[], isFromSync = false) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const now = new Date().toISOString();

    try {
      for (const order of orders) {
        const existingOrder = await store.get(order.id);
        
        // Update logic dengan conflict resolution
        if (existingOrder) {
          // Jika dari sync, gunakan server data kecuali local ada perubahan pending
          if (isFromSync && !existingOrder.is_dirty) {
            await store.put({
              ...order,
              last_sync: now,
              is_dirty: false,
              sync_version: (existingOrder.sync_version || 0) + 1
            });
          }
          // Jika bukan dari sync, update local data
          else if (!isFromSync) {
            await store.put({
              ...order,
              last_sync: now,
              is_dirty: true,
              sync_version: existingOrder.sync_version || 0
            });
          }
        } else {
          // New order
          await store.put({
            ...order,
            last_sync: now,
            is_dirty: !isFromSync,
            sync_version: 1
          });
        }
      }

      await tx.done;
      console.log(`[OfflineStorage] Saved ${orders.length} orders`);
    } catch (error) {
      console.error('[OfflineStorage] Failed to save orders:', error);
      throw error;
    }
  }

  async getOrders(filters?: {
    status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
    courier_id?: number;
    limit?: number;
  }) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('orders', 'readonly');
    const store = tx.objectStore('orders');

    try {
      let orders: any[] = [];

      if (filters?.status) {
        orders = await store.index('by-status').getAll(filters.status);
      } else if (filters?.courier_id) {
        orders = await store.index('by-courier').getAll(filters.courier_id);
      } else {
        orders = await store.getAll();
      }

      // Apply limit if specified
      if (filters?.limit) {
        orders = orders.slice(0, filters.limit);
      }

      // Sort by created_at descending
      orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return orders;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get orders:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: number, status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled', timestamp?: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');

    try {
      const order = await store.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Update order
      const updatedOrder = {
        ...order,
        status,
        is_dirty: true,
        last_sync: new Date().toISOString(),
        sync_version: order.sync_version + 1
      };

      // Add timestamp fields based on status
      if (timestamp) {
        switch (status) {
          case 'picked_up':
            updatedOrder.picked_up_at = timestamp;
            break;
          case 'delivered':
            updatedOrder.delivered_at = timestamp;
            break;
        }
      }

      await store.put(updatedOrder);

      // Queue for sync
      await this.queueSyncAction({
        action: 'update',
        endpoint: `/api/courier/orders/${orderId}/status`,
        method: 'PUT',
        data: { status, timestamp }
      });

      await tx.done;
      console.log(`[OfflineStorage] Updated order ${orderId} status to ${status}`);
      return updatedOrder;
    } catch (error) {
      console.error('[OfflineStorage] Failed to update order status:', error);
      throw error;
    }
  }

  // Sync queue management
  async queueSyncAction(action: {
    action: 'create' | 'update' | 'delete';
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    data: any;
  }) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    const syncItem = {
      id: Math.random().toString(36).substr(2, 9),
      ...action,
      timestamp: Date.now(),
      retry_count: 0
    };

    await store.put(syncItem);
    await tx.done;

    console.log('[OfflineStorage] Action queued for sync:', syncItem.id);
    return syncItem.id;
  }

  async getPendingSyncActions() {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('by-timestamp');

    try {
      // Get actions ordered by timestamp (oldest first)
      return await index.getAll();
    } catch (error) {
      console.error('[OfflineStorage] Failed to get pending actions:', error);
      return [];
    }
  }

  async removeSyncAction(actionId: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    await store.delete(actionId);
    await tx.done;

    console.log('[OfflineStorage] Removed sync action:', actionId);
  }

  async incrementSyncRetry(actionId: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    const action = await store.get(actionId);
    if (action) {
      action.retry_count += 1;
      action.last_attempt = Date.now();
      await store.put(action);
    }

    await tx.done;
  }

  // Courier profile management
  async saveCourierProfile(profile: any) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('courier_profile', 'readwrite');
    const store = tx.objectStore('courier_profile');

    await store.put({
      ...profile,
      last_sync: new Date().toISOString(),
      is_dirty: false
    });

    await tx.done;
    console.log('[OfflineStorage] Saved courier profile');
  }

  async getCourierProfile(courierId: number) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('courier_profile', 'readonly');
    const store = tx.objectStore('courier_profile');

    return await store.get(courierId);
  }

  // API cache management
  async cacheApiResponse(url: string, data: any, ttlMinutes = 5) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('api_cache', 'readwrite');
    const store = tx.objectStore('api_cache');

    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

    await store.put({
      url,
      data,
      timestamp: Date.now(),
      expires_at: expiresAt
    });

    await tx.done;
    console.log('[OfflineStorage] Cached API response:', url);
  }

  async getCachedApiResponse(url: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('api_cache', 'readonly');
    const store = tx.objectStore('api_cache');

    try {
      const cached = await store.get(url);
      
      if (!cached) return null;
      
      // Check if expired
      if (Date.now() > cached.expires_at) {
        console.log('[OfflineStorage] Cache expired:', url);
        await this.deleteCachedApiResponse(url);
        return null;
      }

      console.log('[OfflineStorage] Cache hit:', url);
      return cached.data;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached response:', error);
      return null;
    }
  }

  async deleteCachedApiResponse(url: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('api_cache', 'readwrite');
    const store = tx.objectStore('api_cache');

    await store.delete(url);
    await tx.done;
  }

  // Settings management
  async saveSetting(key: string, value: any) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');

    await store.put({
      key,
      value,
      updated_at: new Date().toISOString()
    });

    await tx.done;
  }

  async getSetting(key: string) {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');

    const setting = await store.get(key);
    return setting?.value;
  }

  // Cleanup expired cache
  async cleanupExpiredCache() {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('api_cache', 'readwrite');
    const store = tx.objectStore('api_cache');
    const index = store.index('by-expires');

    const now = Date.now();
    const expiredKeys = [];

    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
    while (cursor) {
      expiredKeys.push(cursor.primaryKey);
      cursor = await cursor.continue();
    }

    for (const key of expiredKeys) {
      await store.delete(key);
    }

    await tx.done;
    console.log(`[OfflineStorage] Cleaned up ${expiredKeys.length} expired cache entries`);
  }

  // Get storage statistics
  async getStorageStats() {
    if (!this.db) throw new Error('Database not initialized');

    const stats = {
      orders: 0,
      pendingSync: 0,
      cachedApi: 0,
      settings: 0
    };

    try {
      const tx = this.db.transaction(['orders', 'sync_queue', 'api_cache', 'settings'], 'readonly');
      
      stats.orders = await tx.objectStore('orders').count();
      stats.pendingSync = await tx.objectStore('sync_queue').count();
      stats.cachedApi = await tx.objectStore('api_cache').count();
      stats.settings = await tx.objectStore('settings').count();
    } catch (error) {
      console.error('[OfflineStorage] Failed to get storage stats:', error);
    }

    return stats;
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage();

// Hook for React components
export function useOfflineStorage() {
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const initStorage = async () => {
      try {
        await offlineStorage.init();
        setIsReady(true);
        
        // Get initial stats
        const storageStats = await offlineStorage.getStorageStats();
        setStats(storageStats);
      } catch (error) {
        console.error('[OfflineStorage] Failed to initialize:', error);
      }
    };

    initStorage();
  }, []);

  return {
    isReady,
    stats,
    storage: offlineStorage
  };
}
