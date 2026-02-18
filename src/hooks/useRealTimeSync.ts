// Real-time Sync Manager untuk Instant Delivery System
import { useState, useEffect, useCallback, useRef } from 'react';

interface SyncConfig {
  endpoint: string;
  interval: number;
  priority: 'critical' | 'normal' | 'low';
  retryAttempts?: number;
  retryDelay?: number;
}

interface SyncStatus {
  online: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  syncInProgress: boolean;
  error: string | null;
}

export function useRealTimeSync(configs: SyncConfig[]) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    online: navigator.onLine,
    lastSync: null,
    pendingChanges: 0,
    syncInProgress: false,
    error: null
  });

  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const pendingQueueRef = useRef<any[]>([]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, online: true, error: null }));
      console.log('[RealTimeSync] Connection restored');
      // Trigger immediate sync when back online
      triggerImmediateSync();
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, online: false }));
      console.log('[RealTimeSync] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'REAL_TIME_UPDATE') {
        console.log('[RealTimeSync] Real-time update received:', event.data.payload);
        // Trigger immediate refresh for critical updates
        if (event.data.payload.priority === 'urgent') {
          triggerImmediateSync();
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Sync function with retry logic
  const syncData = useCallback(async (config: SyncConfig) => {
    if (!syncStatus.online) {
      console.log('[RealTimeSync] Offline - skipping sync for:', config.endpoint);
      return;
    }

    setSyncStatus(prev => ({ ...prev, syncInProgress: true, error: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(config.endpoint, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Client-Time': Date.now().toString()
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Reset retry count on success
      retryCountRef.current.delete(config.endpoint);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        syncInProgress: false,
        error: null
      }));

      console.log('[RealTimeSync] Sync successful:', config.endpoint);
      return data;

    } catch (error) {
      const retryCount = (retryCountRef.current.get(config.endpoint) || 0) + 1;
      retryCountRef.current.set(config.endpoint, retryCount);

      const maxRetries = config.retryAttempts || 3;
      
      if (retryCount <= maxRetries) {
        console.log(`[RealTimeSync] Retry ${retryCount}/${maxRetries} for:`, config.endpoint);
        
        // Schedule retry with exponential backoff
        const delay = (config.retryDelay || 1000) * Math.pow(2, retryCount - 1);
        setTimeout(() => syncData(config), delay);
      } else {
        console.error('[RealTimeSync] Max retries exceeded:', config.endpoint);
        setSyncStatus(prev => ({
          ...prev,
          syncInProgress: false,
          error: `Sync failed after ${maxRetries} attempts`
        }));
      }
    }
  }, [syncStatus.online]);

  // Trigger immediate sync for all configs
  const triggerImmediateSync = useCallback(() => {
    configs.forEach(config => {
      if (config.priority === 'critical') {
        syncData(config);
      }
    });
  }, [configs, syncData]);

  // Setup periodic sync intervals
  useEffect(() => {
    // Clear existing intervals
    intervalsRef.current.forEach(interval => clearInterval(interval));
    intervalsRef.current.clear();

    // Setup new intervals
    configs.forEach(config => {
      if (config.interval > 0) {
        const interval = setInterval(() => {
          syncData(config);
        }, config.interval);
        
        intervalsRef.current.set(config.endpoint, interval);
      }
    });

    return () => {
      intervalsRef.current.forEach(interval => clearInterval(interval));
    };
  }, [configs, syncData]);

  // Queue offline actions
  const queueAction = useCallback((action: any) => {
    pendingQueueRef.current.push({
      ...action,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    });

    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingQueueRef.current.length
    }));

    console.log('[RealTimeSync] Action queued for sync:', action);

    // Try to sync if online
    if (syncStatus.online) {
      processPendingQueue();
    }
  }, [syncStatus.online]);

  // Process pending queue
  const processPendingQueue = useCallback(async () => {
    if (pendingQueueRef.current.length === 0 || !syncStatus.online) {
      return;
    }

    console.log('[RealTimeSync] Processing pending queue...');
    
    const actions = [...pendingQueueRef.current];
    pendingQueueRef.current = [];

    for (const action of actions) {
      try {
        await fetch(action.endpoint, {
          method: action.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...action.headers
          },
          body: JSON.stringify(action.data)
        });

        console.log('[RealTimeSync] Queued action synced:', action.id);
      } catch (error) {
        console.error('[RealTimeSync] Failed to sync queued action:', action.id, error);
        // Re-queue failed action
        pendingQueueRef.current.push(action);
      }
    }

    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingQueueRef.current.length
    }));
  }, [syncStatus.online]);

  // Process queue when coming back online
  useEffect(() => {
    if (syncStatus.online && pendingQueueRef.current.length > 0) {
      processPendingQueue();
    }
  }, [syncStatus.online, processPendingQueue]);

  // Manual sync trigger
  const manualSync = useCallback((endpoint?: string) => {
    if (endpoint) {
      const config = configs.find(c => c.endpoint === endpoint);
      if (config) {
        syncData(config);
      }
    } else {
      triggerImmediateSync();
    }
  }, [configs, syncData, triggerImmediateSync]);

  // Clear pending queue
  const clearPendingQueue = useCallback(() => {
    pendingQueueRef.current = [];
    setSyncStatus(prev => ({ ...prev, pendingChanges: 0 }));
  }, []);

  return {
    syncStatus,
    queueAction,
    manualSync,
    clearPendingQueue,
    triggerImmediateSync
  };
}
