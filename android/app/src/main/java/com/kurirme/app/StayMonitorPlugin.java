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
