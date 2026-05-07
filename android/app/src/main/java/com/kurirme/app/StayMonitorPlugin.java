package com.kurirme.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "StayMonitor",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        ),
        @Permission(
            alias = "backgroundLocation",
            strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class StayMonitorPlugin extends Plugin {
    
    private static final String TAG = "StayMonitorPlugin";
    
    @Override
    public void load() {
        super.load();
        Log.i(TAG, "✅ StayMonitorPlugin loaded successfully");
    }

    /**
     * Issue #1: Background Location Permission
     * Custom method to handle the two-step permission flow for Android 10+
     */
    @PluginMethod
    public void requestBackgroundLocation(PluginCall call) {
        Log.i(TAG, "📍 requestBackgroundLocation called");
        
        // Step 1: Check if foreground location is granted
        if (getPermissionState("location") != PermissionState.GRANTED) {
            Log.i(TAG, "Foreground location not granted, requesting...");
            requestPermissionForAlias("location", call, "locationPermsCallback");
        } else {
            // Foreground already granted, request background
            Log.i(TAG, "Foreground location already granted, checking background...");
            checkAndRequestBackgroundLocation(call);
        }
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            Log.i(TAG, "Foreground location granted in callback, checking background...");
            checkAndRequestBackgroundLocation(call);
        } else {
            Log.e(TAG, "Foreground location denied");
            call.reject("Foreground location permission denied");
        }
    }

    private void checkAndRequestBackgroundLocation(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("backgroundLocation") != PermissionState.GRANTED) {
                Log.i(TAG, "Requesting background location (ACCESS_BACKGROUND_LOCATION)...");
                requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermsCallback");
            } else {
                Log.i(TAG, "Background location already granted");
                call.resolve();
            }
        } else {
            // Android 9 and below don't need separate background permission
            Log.i(TAG, "Android < 10, background location implied");
            call.resolve();
        }
    }

    @PermissionCallback
    private void backgroundLocationPermsCallback(PluginCall call) {
        if (getPermissionState("backgroundLocation") == PermissionState.GRANTED) {
            Log.i(TAG, "✅ Background location permission granted");
            call.resolve();
        } else {
            Log.e(TAG, "❌ Background location permission denied");
            call.reject("Background location permission denied");
        }
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        Log.i(TAG, "📍 startMonitoring called");

        // Check for basic location permissions
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission not granted. Please request 'location' permission.");
            return;
        }

        // On Android 10+, background monitoring works best with ACCESS_BACKGROUND_LOCATION
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("backgroundLocation") != PermissionState.GRANTED) {
                Log.w(TAG, "⚠️ Background location not granted. Service may be restricted when app is closed.");
            }
        }

        // Check for FOREGROUND_SERVICE_LOCATION on Android 14+
        if (Build.VERSION.SDK_INT >= 34) {
            if (ContextCompat.checkSelfPermission(getContext(), "android.permission.FOREGROUND_SERVICE_LOCATION") != PackageManager.PERMISSION_GRANTED) {
                call.reject("Missing FOREGROUND_SERVICE_LOCATION manifest declaration.");
                return;
            }
        }
        
        Double lat = call.getDouble("lat");
        Double lng = call.getDouble("lng");
        Integer radius = call.getInt("radius", 10);
        String basecampId = call.getString("basecampId");
        String supabaseUrl = call.getString("supabaseUrl", "");
        String supabaseKey = call.getString("supabaseAnonKey", "");
        String serviceSecret = call.getString("serviceSecret", "");
        String courierId = call.getString("courierId", "");

        if (lat == null || lng == null) {
            call.reject("lat and lng are required");
            return;
        }

        Log.i(TAG, "🚀 Starting service for basecamp: " + basecampId + " (Radius: " + radius + "m)");

        Intent intent = new Intent(getContext(), StayMonitoringService.class);
        intent.setAction(StayMonitoringService.ACTION_START);
        intent.putExtra(StayMonitoringService.EXTRA_LAT, lat);
        intent.putExtra(StayMonitoringService.EXTRA_LNG, lng);
        intent.putExtra(StayMonitoringService.EXTRA_RADIUS, radius);
        intent.putExtra(StayMonitoringService.EXTRA_BASECAMP_ID, basecampId);
        intent.putExtra(StayMonitoringService.EXTRA_SB_URL, supabaseUrl);
        intent.putExtra(StayMonitoringService.EXTRA_SB_KEY, supabaseKey);
        intent.putExtra(StayMonitoringService.EXTRA_SERVICE_SECRET, serviceSecret);
        intent.putExtra(StayMonitoringService.EXTRA_COURIER_ID, courierId);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            Log.i(TAG, "✅ Service start successful");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start service: " + e.getMessage());
            call.reject("Failed to start service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Log.i(TAG, "🛑 Stopping monitoring");
        Intent intent = new Intent(getContext(), StayMonitoringService.class);
        intent.setAction(StayMonitoringService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", StayMonitoringService.isRunning);
        call.resolve(ret);
    }
}
