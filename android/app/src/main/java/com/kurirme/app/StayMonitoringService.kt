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
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

class StayMonitoringService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var wakeLock: PowerManager.WakeLock? = null
    private var locationCallback: LocationCallback? = null

    private var basecampLat   = 0.0
    private var basecampLng   = 0.0
    private var radiusMeters  = 15
    private var basecampId    = ""
    private var supabaseUrl   = ""
    private var supabaseKey   = ""
    private var serviceSecret = ""
    private var courierId     = ""
    private var outZoneCounter = 0

    // GPS Smoothing (EMA) state
    private var smoothedLat = 0.0
    private var smoothedLng = 0.0
    private var hasSmoothedLocation = false
    private var isFirstLocationAfterStart = true  // Coordinate Snap flag

    // Evaluation throttling state (Bug Fix #2)
    private var lastEvaluationTime = 0L
    private var evaluationSequence = 0

    // Uncertain zone timeout state (Bug Fix #1 - Edge Case)
    private var uncertainZoneStartTime = 0L
    private val MAX_UNCERTAIN_DURATION_MS = 60_000L  // 1 minute max

    companion object {
        const val TAG                 = "StayMonitorService"
        const val CHANNEL_ID          = "stay_monitoring_v14"
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
        
        // Configuration Constants
        const val MAX_ACCURACY_THRESHOLD = 150f   // Ignore points > 150m accuracy
        const val STALE_THRESHOLD_NANOS  = 60_000_000_000L // 60 seconds
        const val INTERVAL_MS            = 30_000L
        const val MIN_UPDATE_INTERVAL_MS = 10_000L
        const val CONSECUTIVE_LIMIT      = 4      // Approx 2 minutes of "Definitely Outside"
        const val EVALUATION_THROTTLE_MS = 5_000L // 5 seconds minimum between evaluations (Bug Fix #2)
        
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
                // Extract new basecamp coordinates
                val newLat = intent.getDoubleExtra(EXTRA_LAT, 0.0)
                val newLng = intent.getDoubleExtra(EXTRA_LNG, 0.0)
                
                // BUG FIX #1: Detect basecamp change and force hard reset
                if (isRunning) {
                    Log.w(TAG, "⚠️ Service already running! Performing HARD RESET...")
                    
                    // Detect basecamp change for logging
                    if (basecampLat != 0.0 && basecampLng != 0.0) {
                        val dist = FloatArray(1)
                        Location.distanceBetween(basecampLat, basecampLng, newLat, newLng, dist)
                        if (dist[0] > 10) {
                            Log.w(TAG, "🚨 BASECAMP CHANGED! Distance: ${dist[0].toInt()}m")
                            Log.i(TAG, "   Old Basecamp: (${String.format("%.6f", basecampLat)}, ${String.format("%.6f", basecampLng)})")
                            Log.i(TAG, "   New Basecamp: (${String.format("%.6f", newLat)}, ${String.format("%.6f", newLng)})")
                        }
                    }
                    
                    // CRITICAL: Complete cleanup before restart
                    cleanupTracking()
                    
                    // Small delay to ensure cleanup completes
                    try {
                        Thread.sleep(100)
                    } catch (e: InterruptedException) {
                        Log.w(TAG, "Sleep interrupted during cleanup")
                    }
                }
                
                // Reset ALL state variables (synchronized for thread safety)
                resetAllState()
                
                // Set new basecamp parameters
                basecampLat   = newLat
                basecampLng   = newLng
                radiusMeters  = intent.getIntExtra(EXTRA_RADIUS, 15)
                basecampId    = intent.getStringExtra(EXTRA_BASECAMP_ID) ?: ""
                supabaseUrl   = intent.getStringExtra(EXTRA_SB_URL) ?: ""
                supabaseKey   = intent.getStringExtra(EXTRA_SB_KEY) ?: ""
                serviceSecret = intent.getStringExtra(EXTRA_SERVICE_SECRET) ?: ""
                courierId     = intent.getStringExtra(EXTRA_COURIER_ID) ?: ""

                Log.i(TAG, "🚀 Monitoring Start: BC(${String.format("%.6f", basecampLat)}, ${String.format("%.6f", basecampLng)}) R=${radiusMeters}m Courier=$courierId")
                
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

    /**
     * BUG FIX #1: Thread-safe state reset
     * Resets ALL state variables to prevent contamination from previous basecamp
     */
    @Synchronized
    private fun resetAllState() {
        Log.i(TAG, "🔄 Resetting ALL state variables")
        outZoneCounter = 0
        smoothedLat = 0.0
        smoothedLng = 0.0
        hasSmoothedLocation = false
        isFirstLocationAfterStart = true  // Enable Coordinate Snap
        lastEvaluationTime = 0L
        evaluationSequence = 0
        uncertainZoneStartTime = 0L
    }

    private fun startLocationTracking() {
        Log.i(TAG, "📡 Requesting high-accuracy GPS updates (Interval: ${INTERVAL_MS}ms)")
        
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .setMaxUpdateDelayMillis(0)
            .setGranularity(Granularity.GRANULARITY_FINE)
            .setWaitForAccurateLocation(false)
            .setMinUpdateDistanceMeters(3f) 
            .setMaxUpdateAgeMillis(60_000)  
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val locations = result.locations
                if (locations.isNotEmpty()) {
                    val loc = locations.last()
                    
                    // 1. Stale Location Detection
                    val locationAge = SystemClock.elapsedRealtimeNanos() - loc.elapsedRealtimeNanos
                    if (locationAge > STALE_THRESHOLD_NANOS) {
                        Log.w(TAG, "⚠️ Stale location skipped: ${locationAge / 1_000_000_000}s old")
                        return
                    }

                    // 2. Dynamic EMA Smoothing with Coordinate Snap
                    val alpha = calculateAlpha(loc.accuracy)
                    if (!hasSmoothedLocation) {
                        smoothedLat = loc.latitude
                        smoothedLng = loc.longitude
                        hasSmoothedLocation = true
                        Log.i(TAG, "🎯 Initial smoothed position set: (${String.format("%.6f", smoothedLat)}, ${String.format("%.6f", smoothedLng)})")
                    } else {
                        smoothedLat = (loc.latitude * alpha) + (smoothedLat * (1.0 - alpha))
                        smoothedLng = (loc.longitude * alpha) + (smoothedLng * (1.0 - alpha))
                    }

                    val smoothedLoc = Location(loc).apply {
                        latitude = smoothedLat
                        longitude = smoothedLng
                    }

                    Log.i(TAG, "📍 GPS UPDATE: Raw=(${String.format("%.6f", loc.latitude)}, ${String.format("%.6f", loc.longitude)}) Smooth=(${String.format("%.6f", smoothedLoc.latitude)}, ${String.format("%.6f", smoothedLoc.longitude)}) Acc=${loc.accuracy.toInt()}m Alpha=${String.format("%.2f", alpha)}")
                    evaluateLocation(smoothedLoc, loc.accuracy, loc.latitude, loc.longitude)
                }
            }

            override fun onLocationAvailability(avail: LocationAvailability) {
                Log.i(TAG, "📡 GPS Availability: ${avail.isLocationAvailable}")
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback!!, mainLooper)
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Permission error", e)
            broadcast("error", false, 0, 0f)
            cleanup()
        }
    }

    /**
     * BUG FIX #1: Coordinate Snap - First GPS point after START uses Alpha = 1.0
     * This ensures clean slate with no contamination from previous basecamp
     */
    private fun calculateAlpha(accuracy: Float): Double {
        // Coordinate Snap: First location after START is absolute (no smoothing)
        if (isFirstLocationAfterStart) {
            isFirstLocationAfterStart = false
            Log.i(TAG, "🎯 COORDINATE SNAP: First GPS point - using Alpha=1.0 (no smoothing)")
            return 1.0
        }
        
        // Dynamic alpha based on accuracy
        return when {
            accuracy < 20f -> 0.6  // Good accuracy -> more responsive
            accuracy < 50f -> 0.4  // Medium accuracy -> balanced
            else -> 0.2            // Poor accuracy -> more smoothing
        }
    }

    /**
     * BUG FIX #2: Evaluation with throttling to prevent counter duplication
     * BUG FIX #1: Enhanced logging to debug "In-Zone Forever" issue
     */
    private fun evaluateLocation(loc: Location, accuracy: Float, rawLat: Double, rawLng: Double) {
        // BUG FIX #2: Evaluation throttling
        evaluationSequence++
        val now = System.currentTimeMillis()
        val timeSinceLastEval = now - lastEvaluationTime
        
        // Skip if evaluation too soon (prevent counter duplication from multi-provider updates)
        if (lastEvaluationTime > 0 && timeSinceLastEval < EVALUATION_THROTTLE_MS) {
            Log.w(TAG, "⚠️ EVAL #$evaluationSequence SKIPPED: Too soon (${timeSinceLastEval}ms < ${EVALUATION_THROTTLE_MS}ms)")
            return
        }
        
        lastEvaluationTime = now
        
        // Filter out extremely low accuracy points
        if (accuracy > MAX_ACCURACY_THRESHOLD) {
            Log.w(TAG, "⚠️ EVAL #$evaluationSequence SKIPPED: Low accuracy (${accuracy.toInt()}m > ${MAX_ACCURACY_THRESHOLD.toInt()}m)")
            return
        }

        // Calculate distance using smoothed coordinates
        val dist = FloatArray(1)
        Location.distanceBetween(loc.latitude, loc.longitude, basecampLat, basecampLng, dist)
        val rawDist = dist[0]

        // Hysteresis & Uncertain Zone Logic
        val definitelyOutside = (rawDist - accuracy) > radiusMeters
        val resetBuffer = min(15f, max(5f, accuracy * 0.3f))
        val resetThreshold = radiusMeters.toFloat() + resetBuffer
        val definitelyInside = rawDist < resetThreshold

        val currentState = when {
            rawDist <= radiusMeters -> "INSIDE"
            definitelyOutside -> "OUTSIDE"
            else -> "UNCERTAIN"
        }

        // BUG FIX #1: Enhanced logging for debugging
        Log.i(TAG, "📊 EVAL #$evaluationSequence (${timeSinceLastEval}ms since last):")
        Log.i(TAG, "   Basecamp: (${String.format("%.6f", basecampLat)}, ${String.format("%.6f", basecampLng)}) R=${radiusMeters}m")
        Log.i(TAG, "   Raw GPS:  (${String.format("%.6f", rawLat)}, ${String.format("%.6f", rawLng)})")
        Log.i(TAG, "   Smoothed: (${String.format("%.6f", loc.latitude)}, ${String.format("%.6f", loc.longitude)})")
        Log.i(TAG, "   Distance: ${rawDist.toInt()}m | Accuracy: ${accuracy.toInt()}m | State: $currentState")
        Log.i(TAG, "   Counter: $outZoneCounter/$CONSECUTIVE_LIMIT | Reset Buffer: ${resetBuffer.toInt()}m")

        // State machine logic
        if (definitelyInside) {
            if (outZoneCounter > 0) Log.i(TAG, "✅ User back in zone. Resetting counter.")
            outZoneCounter = 0
            uncertainZoneStartTime = 0L  // Reset uncertain zone timer
            broadcast("update", true, 0, rawDist)
        } else if (definitelyOutside) {
            outZoneCounter++
            uncertainZoneStartTime = 0L  // Reset uncertain zone timer
            Log.w(TAG, "🚨 OUT OF ZONE! ($outZoneCounter/$CONSECUTIVE_LIMIT)")
            broadcast("update", false, outZoneCounter, rawDist)
            
            if (outZoneCounter >= CONSECUTIVE_LIMIT) {
                Log.e(TAG, "🔥 CONSECUTIVE LIMIT REACHED. Revoking STAY status.")
                broadcast("revoked", false, outZoneCounter, rawDist)
                performRevocation()
                cleanup()
            }
        } else {
            // UNCERTAIN ZONE: Freeze counter, but add timeout to prevent infinite stuck
            if (uncertainZoneStartTime == 0L) {
                uncertainZoneStartTime = now
                Log.i(TAG, "⚠️ Entering UNCERTAIN Zone: Holding counter at $outZoneCounter")
            } else {
                val uncertainDuration = now - uncertainZoneStartTime
                if (uncertainDuration > MAX_UNCERTAIN_DURATION_MS) {
                    Log.w(TAG, "⏰ UNCERTAIN Zone TIMEOUT (${uncertainDuration / 1000}s) - treating as OUT OF ZONE")
                    outZoneCounter++
                    uncertainZoneStartTime = 0L
                    broadcast("update", false, outZoneCounter, rawDist)
                    
                    if (outZoneCounter >= CONSECUTIVE_LIMIT) {
                        Log.e(TAG, "🔥 CONSECUTIVE LIMIT REACHED (via uncertain timeout). Revoking STAY status.")
                        broadcast("revoked", false, outZoneCounter, rawDist)
                        performRevocation()
                        cleanup()
                    }
                } else {
                    Log.i(TAG, "⚠️ Still in UNCERTAIN Zone: Holding counter at $outZoneCounter (${uncertainDuration / 1000}s elapsed)")
                    broadcast("update", outZoneCounter == 0, outZoneCounter, rawDist)
                }
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
                    Log.e(TAG, "☁️ Supabase error", e)
                    attempts++
                    if (attempts < maxAttempts) Thread.sleep(2_000L * attempts)
                }
            }
        }.start()
    }

    private fun broadcast(type: String, inZone: Boolean, counter: Int, distance: Float) {
        val data = JSONObject().apply {
            put("type", type); put("inZone", inZone); put("counter", counter)
            put("distance", distance); put("basecampId", basecampId)
            put("timestamp", System.currentTimeMillis())
        }
        val intent = Intent("com.kurirme.STAY_NATIVE_EVENT").apply {
            putExtra("data", data.toString())
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            listOf("stay_monitoring_v11", "stay_monitoring_v12", "stay_monitoring_v13").forEach {
                manager.deleteNotificationChannel(it)
            }
            
            val channel = NotificationChannel(CHANNEL_ID, "Stay Monitoring", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Monitoring status STAY kurir"
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
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
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        }

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR
        
        return notification
    }

    private fun cleanupTracking() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
    }

    private fun cleanup() {
        Log.i(TAG, "🧹 Cleanup: Stopping service")
        cleanupTracking()
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
