package com.kurirdev.app

import android.content.Intent
import android.os.Build
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StayMonitor")
class StayMonitorPlugin : Plugin() {
    
    companion object {
        private const val TAG = "StayMonitorPlugin"
    }
    
    override fun load() {
        super.load()
        Log.i(TAG, "✅ StayMonitorPlugin loaded successfully")
    }

    @PluginMethod
    fun startMonitoring(call: PluginCall) {
        Log.i(TAG, "📍 startMonitoring called")
        val lat           = call.getDouble("lat") ?: run { call.reject("lat required"); return }
        val lng           = call.getDouble("lng") ?: run { call.reject("lng required"); return }
        val radius        = call.getInt("radius") ?: 10
        val basecampId    = call.getString("basecampId") ?: ""
        val supabaseUrl   = call.getString("supabaseUrl") ?: ""
        val supabaseKey   = call.getString("supabaseAnonKey") ?: ""
        val serviceSecret = call.getString("serviceSecret") ?: ""
        val courierId     = call.getString("courierId") ?: ""

        Log.i(TAG, "🚀 Starting service with basecamp: $basecampId, radius: $radius")

        val intent = Intent(context, StayMonitoringService::class.java).apply {
            action = StayMonitoringService.ACTION_START
            putExtra(StayMonitoringService.EXTRA_LAT, lat)
            putExtra(StayMonitoringService.EXTRA_LNG, lng)
            putExtra(StayMonitoringService.EXTRA_RADIUS, radius)
            putExtra(StayMonitoringService.EXTRA_BASECAMP_ID, basecampId)
            putExtra(StayMonitoringService.EXTRA_SB_URL, supabaseUrl)
            putExtra(StayMonitoringService.EXTRA_SB_KEY, supabaseKey)
            putExtra(StayMonitoringService.EXTRA_SERVICE_SECRET, serviceSecret)
            putExtra(StayMonitoringService.EXTRA_COURIER_ID, courierId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        Log.i(TAG, "✅ Service start command sent")
        call.resolve()
    }

    @PluginMethod
    fun stopMonitoring(call: PluginCall) {
        Log.i(TAG, "🛑 stopMonitoring called")
        val intent = Intent(context, StayMonitoringService::class.java).apply {
            action = StayMonitoringService.ACTION_STOP
        }
        context.startService(intent)
        Log.i(TAG, "✅ Service stop command sent")
        call.resolve()
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val running = StayMonitoringService.isRunning
        Log.i(TAG, "❓ isRunning called, result: $running")
        call.resolve(com.getcapacitor.JSObject().apply {
            put("running", running)
        })
    }
}
