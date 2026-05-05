import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PermissionState {
  notification: PermissionStatus;
  location: PermissionStatus;
  camera: PermissionStatus;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionState>({
    notification: 'unknown',
    location: 'unknown',
    camera: 'unknown',
  });

  const [isLoading, setIsLoading] = useState(true);

  // Check all permissions
  const checkPermissions = async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsLoading(false);
      return;
    }

    try {
      // Check Notification
      const notifPerm = await PushNotifications.checkPermissions();
      const notifStatus: PermissionStatus = 
        notifPerm.receive === 'granted' ? 'granted' :
        notifPerm.receive === 'denied' ? 'denied' : 'prompt';

      // Check Location
      const locPerm = await Geolocation.checkPermissions();
      const locStatus: PermissionStatus =
        locPerm.location === 'granted' || locPerm.coarseLocation === 'granted' ? 'granted' :
        locPerm.location === 'denied' ? 'denied' : 'prompt';

      // Check Camera
      const camPerm = await Camera.checkPermissions();
      const camStatus: PermissionStatus =
        camPerm.camera === 'granted' ? 'granted' :
        camPerm.camera === 'denied' ? 'denied' : 'prompt';

      setPermissions({
        notification: notifStatus,
        location: locStatus,
        camera: camStatus,
      });
    } catch (error) {
      console.error('[usePermissions] Error checking permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Request Notification Permission
  const requestNotification = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const result = await PushNotifications.requestPermissions();
      const granted = result.receive === 'granted';
      
      setPermissions(prev => ({
        ...prev,
        notification: granted ? 'granted' : 'denied',
      }));

      return granted;
    } catch (error) {
      console.error('[usePermissions] Error requesting notification:', error);
      return false;
    }
  };

  // Request Location Permission
  const requestLocation = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const result = await Geolocation.requestPermissions();
      const granted = result.location === 'granted' || result.coarseLocation === 'granted';
      
      setPermissions(prev => ({
        ...prev,
        location: granted ? 'granted' : 'denied',
      }));

      return granted;
    } catch (error) {
      console.error('[usePermissions] Error requesting location:', error);
      return false;
    }
  };

  // Request Camera Permission
  const requestCamera = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const result = await Camera.requestPermissions();
      const granted = result.camera === 'granted';
      
      setPermissions(prev => ({
        ...prev,
        camera: granted ? 'granted' : 'denied',
      }));

      return granted;
    } catch (error) {
      console.error('[usePermissions] Error requesting camera:', error);
      return false;
    }
  };

  // Request All Permissions
  const requestAll = async (): Promise<PermissionState> => {
    await Promise.all([
      requestNotification(),
      requestLocation(),
      requestCamera(),
    ]);

    await checkPermissions();
    return permissions;
  };

  // Open App Settings
  const openSettings = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await App.openUrl({ url: 'app-settings:' });
    } catch (error) {
      console.error('[usePermissions] Error opening settings:', error);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  return {
    permissions,
    isLoading,
    checkPermissions,
    requestNotification,
    requestLocation,
    requestCamera,
    requestAll,
    openSettings,
  };
}
