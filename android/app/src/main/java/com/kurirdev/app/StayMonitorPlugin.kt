package com.kurirdev.app

import android.content.Intent
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StayMonitor")
class StayMonitorPlugin : Plugin() {

    @PluginMethod
    fun startMonitoring(call: PluginCall) {
        val lat           = call.getDouble("lat") ?: run { call.reject("lat required"); return }
        val lng           = call.getDouble("lng") ?: run { call.reject("lng required"); return }
        val radius        = call.getInt("radius") ?: 10
        val basecampId    = call.getString("basecampId") ?: ""
        val supabaseUrl   = call.getString("supabaseUrl") ?: ""
        val supabaseKey   = call.getString("supabaseAnonKey") ?: ""
        val serviceSecret = call.getString("serviceSecret") ?: ""
        val courierId     = call.getString("courierId") ?: ""

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
        call.resolve()
    }

    @PluginMethod
    fun stopMonitoring(call: PluginCall) {
        val intent = Intent(context, StayMonitoringService::class.java).apply {
            action = StayMonitoringService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        call.resolve(com.getcapacitor.JSObject().apply {
            put("running", StayMonitoringService.isRunning)
        })
    }
}
