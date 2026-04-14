import { useState, useEffect } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface LocationState {
  coords: {
    latitude: number;
    longitude: number;
  } | null;
  error: string | null;
  isLoading: boolean;
}

export function useCurrentLocation(active: boolean = false) {
  const [state, setState] = useState<LocationState>({
    coords: null,
    error: null,
    isLoading: true,
  });

  const [watchId, setWatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
        setWatchId(null);
      }
      return;
    }

    const startTracking = async () => {
      try {
        const permissions = await Geolocation.checkPermissions();
        
        if (permissions.location === 'denied') {
          const request = await Geolocation.requestPermissions();
          if (request.location === 'denied') {
            setState(s => ({ ...s, error: 'Izin lokasi ditolak', isLoading: false }));
            return;
          }
        }

        // Get initial position
        const currentPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });

        setState({
          coords: {
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          },
          error: null,
          isLoading: false,
        });

        // Start watching position
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
          },
          (position, err) => {
            if (err) {
              console.error('Watch location error:', err);
              return;
            }
            if (position) {
              setState({
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                },
                error: null,
                isLoading: false,
              });
            }
          }
        );
        setWatchId(id);
      } catch (err: any) {
        console.error('Geolocation error:', err);
        setState(s => ({ 
          ...s, 
          error: err.message || 'Gagal mengambil lokasi', 
          isLoading: false 
        }));
      }
    };

    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [active]);

  return state;
}
