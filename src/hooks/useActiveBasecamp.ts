import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useToastStore } from '@/stores/useToastStore';

const STORAGE_KEY = 'activeBasecampId';

interface Basecamp {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}

export function useActiveBasecamp() {
  const [activeBasecampId, setActiveBasecampId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const { basecamps } = useSettingsStore();
  const { addToast } = useToastStore();

  // Get active basecamp object
  const activeBasecamp = basecamps.find((b: Basecamp) => b.id === activeBasecampId) || null;

  // Set active basecamp
  const setActiveBasecamp = (basecampId: string | null) => {
    if (basecampId) {
      localStorage.setItem(STORAGE_KEY, basecampId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setActiveBasecampId(basecampId);
  };

  // Listen to storage events for multi-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setActiveBasecampId(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Validate active basecamp still exists and is active
  useEffect(() => {
    if (activeBasecampId && basecamps.length > 0) {
      if (activeBasecamp) {
        if (!activeBasecamp.is_active) {
          console.warn('Active basecamp is inactive:', activeBasecamp.name);
          addToast(
            `Basecamp "${activeBasecamp.name}" sudah tidak aktif. Silakan pilih basecamp lain di Settings.`,
            'warning',
            5000
          );
        }
      } else {
        // Basecamp was deleted
        console.warn('Active basecamp no longer exists, clearing selection');
        addToast(
          'Basecamp yang dipilih sudah tidak tersedia. Silakan pilih basecamp lain di Settings.',
          'warning',
          3000
        );
        setActiveBasecamp(null);
      }
    }
  }, [activeBasecampId, activeBasecamp, basecamps.length, addToast]);

  return {
    activeBasecampId,
    activeBasecamp,
    setActiveBasecamp,
  };
}
