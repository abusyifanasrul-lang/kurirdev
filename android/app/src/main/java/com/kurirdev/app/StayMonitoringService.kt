package com.kurirdev.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import org.json.JSONObject

class StayMonitoringService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var wakeLock: PowerManager.WakeLock? = null
    private var locationCallback: LocationCallback? = null

    private var basecampLat   = 0.0
    private var basecampLng   = 0.0
    private var radiusMeters  = 10
    private var basecampId    = ""
    private var supabaseUrl   = ""
    private var supabaseKey   = ""
    private var serviceSecret = ""
    private var courierId     = ""
    private var outZoneCounter = 0

    companion object {
        const val CHANNEL_ID          = "stay_monitoring"
        const val NOTIF_ID            = 2001
        const val ACTION_START        = "START_STAY"
        const val ACTION_STOP         = "STOP_STAY"
        const val EXTRA_LAT           = "lat"
        const val EXTRA_LNG           = "lng"
        const val EXTRA_RADIUS        = "radius"
        const val EXTRA_BASECAMP_ID   = "basecampId"
        const val EXTRA_SB_URL        = "supabaseUrl"
        const val EXTRA_SB_KEY        = "supabaseAnonKey"
        const val EXTRA_SERVICE_SECRET = "serviceSecret"
        const val EXTRA_COURIER_ID    = "courierId"
        const val MAX_ACCURACY_M      = 50f
        const val INTERVAL_MS         = 60_000L
        const val CONSECUTIVE_LIMIT   = 5
        @Volatile var isRunning       = false
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "KurirDev:StayLock")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                basecampLat   = intent.getDoubleExtra(EXTRA_LAT, 0.0)
                basecampLng   = intent.getDoubleExtra(EXTRA_LNG, 0.0)
                radiusMeters  = intent.getIntExtra(EXTRA_RADIUS, 10)
                basecampId    = intent.getStringExtra(EXTRA_BASECAMP_ID) ?: ""
                supabaseUrl   = intent.getStringExtra(EXTRA_SB_URL) ?: ""
                supabaseKey   = intent.getStringExtra(EXTRA_SB_KEY) ?: ""
                serviceSecret = intent.getStringExtra(EXTRA_SERVICE_SECRET) ?: ""
                courierId     = intent.getStringExtra(EXTRA_COURIER_ID) ?: ""
                outZoneCounter = 0

                wakeLock?.acquire()
                startForeground(NOTIF_ID, buildNotification("Monitoring lokasi STAY aktif"))
                startLocationTracking()
                isRunning = true
            }
            ACTION_STOP -> {
                cleanup()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun startLocationTracking() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(30_000)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { evaluateLocation(it) }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback!!, mainLooper)
        } catch (e: SecurityException) {
            broadcast("error", false, 0, 0f)
            cleanup()
        }
    }

    private fun evaluateLocation(loc: Location) {
        if (loc.accuracy > MAX_ACCURACY_M) return

        val dist = FloatArray(1)
        Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)

        val effectiveDist = dist[0] - loc.accuracy
        val inZone = effectiveDist <= radiusMeters

        if (inZone) {
            outZoneCounter = 0
            broadcast("update", true, 0, dist[0])
        } else {
            outZoneCounter++
            broadcast("update", false, outZoneCounter, dist[0])
            if (outZoneCounter >= CONSECUTIVE_LIMIT) {
                broadcast("revoked", false, outZoneCounter, dist[0])
                performRevocation()
                cleanup()
            }
        }
    }

    private fun performRevocation() {
        if (supabaseUrl.isEmpty() || supabaseKey.isEmpty() || serviceSecret.isEmpty() || courierId.isEmpty()) return

        Thread {
            try {
                val url = java.net.URL("$supabaseUrl/rest/v1/rpc/revoke_stay_by_service")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("apikey", supabaseKey)
                conn.setRequestProperty("Authorization", "Bearer $supabaseKey")
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val body = JSONObject().apply {
                    put("p_courier_id", courierId)
                    put("p_secret", serviceSecret)
                }

                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                android.util.Log.d("StayMonitor", "Revocation response: ${conn.responseCode}")
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun broadcast(type: String, inZone: Boolean, counter: Int, distance: Float) {
        val data = JSONObject().apply {
            put("type", type)
            put("inZone", inZone)
            put("counter", counter)
            put("distance", distance)
            put("basecampId", basecampId)
            put("timestamp", System.currentTimeMillis())
        }
        sendBroadcast(Intent("com.kurirdev.STAY_NATIVE_EVENT").putExtra("data", data.toString()))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Stay Monitor", NotificationManager.IMPORTANCE_LOW).apply {
                description = "GPS monitoring kurir STAY"
                setShowBadge(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KurirDev: STAY")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun cleanup() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        wakeLock?.let { if (it.isHeld) it.release() }
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        cleanup()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
