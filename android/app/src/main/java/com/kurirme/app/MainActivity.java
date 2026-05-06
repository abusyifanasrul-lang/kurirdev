package com.kurirme.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    private final BroadcastReceiver stayReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            try {
                String jsonData = intent.getStringExtra("data");
                if (jsonData != null) {
                    runOnUiThread(() -> {
                        if (bridge != null && bridge.getWebView() != null) {
                            bridge.getWebView().post(() ->
                                bridge.getWebView().evaluateJavascript(
                                    "window.__STAY_NATIVE_CALLBACK&&window.__STAY_NATIVE_CALLBACK(" + jsonData + ")",
                                    null
                                )
                            );
                        }
                    });
                }
            } catch (Exception e) {
                Log.e(TAG, "Bridge error", e);
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register plugins BEFORE calling super.onCreate
        registerPlugin(StayMonitorPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        Log.i(TAG, "✅ StayMonitorPlugin registered and bridge initialized");

        IntentFilter filter = new IntentFilter("com.kurirme.STAY_NATIVE_EVENT");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stayReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(stayReceiver, filter);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(stayReceiver);
        } catch (Exception e) {
            Log.e(TAG, "Unregister error", e);
        }
    }
}
