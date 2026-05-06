package com.kurirme.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
        // Updated channel ID to v10 to force reset system-level settings for the notification
        const val CHANNEL_ID          = "stay_monitoring_v10"
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
        Log.i(TAG, "✅ Service Created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.i(TAG, "onStartCommand: action=$action, isRunning=$isRunning")

        when (action) {
            ACTION_START -> {
                // CRITICAL: If already running, stop first to prevent multiple instances
                if (isRunning) {
                    Log.w(TAG, "⚠️ Service already running! Stopping old instance first...")
                    cleanup()
                    // Small delay to ensure cleanup completes
                    Thread.sleep(300)
                }
                
                basecampLat   = intent.getDoubleExtra(EXTRA_LAT, 0.0)
                basecampLng   = intent.getDoubleExtra(EXTRA_LNG, 0.0)
                radiusMeters  = intent.getIntExtra(EXTRA_RADIUS, 15)
                basecampId    = intent.getStringExtra(EXTRA_BASECAMP_ID) ?: ""
                supabaseUrl   = intent.getStringExtra(EXTRA_SB_URL) ?: ""
                supabaseKey   = intent.getStringExtra(EXTRA_SB_KEY) ?: ""
                serviceSecret = intent.getStringExtra(EXTRA_SERVICE_SECRET) ?: ""
                courierId     = intent.getStringExtra(EXTRA_COURIER_ID) ?: ""
                outZoneCounter = 0

                Log.i(TAG, "🚀 Monitoring Start: BC($basecampLat, $basecampLng) R=$radiusMeters Courier=$courierId")
                
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
                    Log.e(TAG, "❌ Failed to start foreground service", e)
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
            ACTION_STOP -> {
                Log.i(TAG, "🛑 Stopping monitoring service")
                cleanup()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun startLocationTracking() {
        Log.i(TAG, "📡 Requesting high-accuracy GPS updates (Interval: ${INTERVAL_MS}ms)")
        
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(15_000)
            .setMaxUpdateDelayMillis(0) // Crucial: Do not batch updates
            .setGranularity(Granularity.GRANULARITY_FINE)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                // CRITICAL: Use locations (plural) to get ALL new locations, not just last cached one
                val locations = result.locations
                if (locations.isNotEmpty()) {
                    // Get the MOST RECENT location (last in list)
                    val loc = locations.last()
                    Log.i(TAG, "📍 GPS UPDATE: Lat=${loc.latitude}, Lng=${loc.longitude}, Acc=${loc.accuracy.toInt()}m, Time=${loc.time}")
                    evaluateLocation(loc)
                } else {
                    Log.w(TAG, "📍 GPS UPDATE: No locations in result")
                }
            }

            override fun onLocationAvailability(avail: LocationAvailability) {
                Log.i(TAG, "📡 GPS Availability: ${avail.isLocationAvailable}")
                if (!avail.isLocationAvailable) {
                    Log.e(TAG, "❌ GPS NOT AVAILABLE - location updates may not work!")
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback!!, mainLooper)
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Permission error during tracking request", e)
            broadcast("error", false, 0, 0f)
            cleanup()
        }
    }

    private fun evaluateLocation(loc: Location) {
        val dist = FloatArray(1)
        Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)
        val rawDist = dist[0]

        // CRITICAL: If accuracy is poor, we MUST still evaluate but log warning
        // DO NOT skip evaluation or counter will keep running from old state
        if (loc.accuracy > MAX_ACCURACY_M) {
            Log.w(TAG, "⚠️ Low accuracy (${loc.accuracy.toInt()}m) - evaluation may be inaccurate")
        }

        // STRICT LOGIC: Raw distance must be within radius
        val inZone = rawDist <= radiusMeters

        Log.i(TAG, "📊 EVAL: Dist=${rawDist.toInt()}m | Limit=${radiusMeters}m | InZone=$inZone | Counter=$outZoneCounter | Acc=${loc.accuracy.toInt()}m")

        if (inZone) {
            if (outZoneCounter > 0) Log.i(TAG, "✅ User returned to zone. Resetting counter.")
            outZoneCounter = 0
            broadcast("update", true, 0, rawDist)
        } else {
            outZoneCounter++
            Log.w(TAG, "🚨 OUT OF ZONE! ($outZoneCounter/$CONSECUTIVE_LIMIT)")
            broadcast("update", false, outZoneCounter, rawDist)
            
            if (outZoneCounter >= CONSECUTIVE_LIMIT) {
                Log.e(TAG, "🔥 CONSECUTIVE LIMIT REACHED. Revoking STAY status.")
                broadcast("revoked", false, outZoneCounter, rawDist)
                performRevocation()
                cleanup()
            }
        }
    }

    private fun performRevocation() {
        if (supabaseUrl.isEmpty() || supabaseKey.isEmpty()) {
            Log.e(TAG, "❌ Revocation aborted: Missing Supabase config")
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
                    Log.i(TAG, "☁️ Supabase RPC Response: $code")
                    conn.disconnect()

                    if (code in 200..299) {
                        Log.i(TAG, "✅ Revocation successful")
                        break
                    }
                    attempts++
                    if (attempts < maxAttempts) Thread.sleep(2_000L * attempts)
                } catch (e: Exception) {
                    Log.e(TAG, "☁️ Supabase request error", e)
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
            val channel = NotificationChannel(CHANNEL_ID, "Stay Monitoring", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Monitoring status STAY kurir"
                setShowBadge(true)
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KurirMe: STAY")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true) 
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        }

        val notification = builder.build()
        // Force the flags at the bit level to ensure persistence as much as possible on newer Androids
        notification.flags = notification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR
        
        return notification
    }

    private fun cleanup() {
        Log.i(TAG, "🧹 Cleanup: Releasing tracking and wake lock")
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        wakeLock?.let { if (it.isHeld) it.release() }
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.w(TAG, "⚠️ Task removed. Service is still running in foreground.")
    }

    override fun onDestroy() {
        Log.i(TAG, "Service Destroyed")
        super.onDestroy()
        cleanup()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
