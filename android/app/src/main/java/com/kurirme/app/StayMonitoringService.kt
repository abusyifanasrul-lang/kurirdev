package com.kurirme.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
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
        const val TAG                 = "StayMonitorService"
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
        const val MAX_ACCURACY_M      = 60f
        const val INTERVAL_MS         = 30_000L
        const val CONSECUTIVE_LIMIT   = 5
        @JvmField
        @Volatile var isRunning       = false
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "KurirMe:StayLock")
        Log.d(TAG, "Service Created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand: action=$action")

        when (action) {
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

                Log.i(TAG, "Starting monitoring: Basecamp($basecampLat, $basecampLng), Radius=$radiusMeters")
                
                if (wakeLock?.isHeld == false) {
                    wakeLock?.acquire(8 * 60 * 60 * 1000L)
                }
                
                val notification = buildNotification("Monitoring lokasi STAY aktif")
                
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
                    } else {
                        startForeground(NOTIF_ID, notification)
                    }
                    startLocationTracking()
                    isRunning = true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start foreground service", e)
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
            ACTION_STOP -> {
                Log.i(TAG, "Stopping monitoring service")
                cleanup()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun startLocationTracking() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(20_000)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { 
                    Log.d(TAG, "Location Update: ${it.latitude}, ${it.longitude} (acc: ${it.accuracy}m)")
                    evaluateLocation(it) 
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback!!, mainLooper)
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission missing", e)
            broadcast("error", false, 0, 0f)
            cleanup()
        }
    }

    private fun evaluateLocation(loc: Location) {
        // Ignore very inaccurate locations to prevent false out-of-zone events
        if (loc.accuracy > MAX_ACCURACY_M) {
            Log.w(TAG, "Ignoring inaccurate location: ${loc.accuracy}m")
            return
        }

        val dist = FloatArray(1)
        Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)

        val rawDist = dist[0]
        // Subtract accuracy to be lenient (best-case distance)
        val effectiveDist = Math.max(0f, rawDist - loc.accuracy)
        val inZone = effectiveDist <= radiusMeters

        Log.i(TAG, "Evaluation: dist=${rawDist.toInt()}m, effective=${effectiveDist.toInt()}m, inZone=$inZone, counter=$outZoneCounter")

        if (inZone) {
            if (outZoneCounter > 0) Log.i(TAG, "Back in zone. Counter reset.")
            outZoneCounter = 0
            broadcast("update", true, 0, rawDist)
        } else {
            outZoneCounter++
            Log.w(TAG, "Out of zone! Counter=$outZoneCounter/$CONSECUTIVE_LIMIT")
            broadcast("update", false, outZoneCounter, rawDist)
            
            if (outZoneCounter >= CONSECUTIVE_LIMIT) {
                Log.e(TAG, "Consecutive limit reached. Revoking stay.")
                broadcast("revoked", false, outZoneCounter, rawDist)
                performRevocation()
                cleanup()
            }
        }
    }

    private fun performRevocation() {
        if (supabaseUrl.isEmpty() || supabaseKey.isEmpty() || serviceSecret.isEmpty() || courierId.isEmpty()) {
            Log.e(TAG, "Cannot revoke: Missing configuration")
            return
        }

        Thread {
            var attempts = 0
            val maxAttempts = 3
            while (attempts < maxAttempts) {
                try {
                    val url = java.net.URL("$supabaseUrl/rest/v1/rpc/revoke_stay_by_service")
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 15_000
                    conn.readTimeout = 10_000
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
                    val code = conn.responseCode
                    Log.d(TAG, "Revocation HTTP Response: $code")
                    conn.disconnect()

                    if (code in 200..299) {
                        Log.i(TAG, "Successfully revoked stay via Supabase RPC")
                        break
                    }
                    attempts++
                    if (attempts < maxAttempts) Thread.sleep(2_000L * attempts)
                } catch (e: Exception) {
                    Log.e(TAG, "Revocation attempt $attempts failed", e)
                    attempts++
                    if (attempts < maxAttempts) Thread.sleep(2_000L * attempts)
                }
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
        val intent = Intent("com.kurirme.STAY_NATIVE_EVENT")
        intent.putExtra("data", data.toString())
        intent.setPackage(packageName)
        sendBroadcast(intent)
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
            .setContentTitle("KurirMe: STAY")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    private fun cleanup() {
        Log.d(TAG, "Cleaning up service resources")
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        wakeLock?.let { if (it.isHeld) it.release() }
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        super.onDestroy()
        cleanup()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
