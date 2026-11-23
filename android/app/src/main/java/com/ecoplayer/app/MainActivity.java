package com.ecoplayer.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume");
        // App is in the foreground — stop the background audio service if it is running.
        stopService(new Intent(this, BackgroundAudioService.class));
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause");
        // App went to the background — keep audio playing via a foreground service.
        Intent service = new Intent(this, BackgroundAudioService.class);
        service.putExtra("playing", true);
        startForegroundService(service);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy");
        stopService(new Intent(this, BackgroundAudioService.class));
    }

    /** Keep the Capacitor WebView alive while the app is backgrounded so audio continues. */
    @Override
    protected void onStart() {
        super.onStart();
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setPause(false);
        }
    }

    @Override
    protected void onStop() {
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setPause(false);
        }
        super.onStop();
    }
}
