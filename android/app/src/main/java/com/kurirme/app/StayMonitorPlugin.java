package com.kurirme.app;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StayMonitor")
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

        Log.i(TAG, "🚀 Starting service with basecamp: " + basecampId + ", radius: " + radius);

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        
        Log.i(TAG, "✅ Service start command sent");
        call.resolve();
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Log.i(TAG, "🛑 stopMonitoring called");
        
        Intent intent = new Intent(getContext(), StayMonitoringService.class);
        intent.setAction(StayMonitoringService.ACTION_STOP);
        getContext().startService(intent);
        
        Log.i(TAG, "✅ Service stop command sent");
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        boolean running = StayMonitoringService.isRunning;
        Log.i(TAG, "❓ isRunning called, result: " + running);
        
        JSObject ret = new JSObject();
        ret.put("running", running);
        call.resolve(ret);
    }
}
