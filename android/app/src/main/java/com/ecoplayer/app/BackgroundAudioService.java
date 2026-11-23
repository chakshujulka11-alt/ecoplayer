package com.ecoplayer.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class BackgroundAudioService extends Service implements MediaPlayer.OnErrorListener {
    private static final String TAG = "BackgroundAudioService";
    private static final int NOTIFICATION_ID = 1;
    private static final String CHANNEL_ID = "ecoplayer_background_audio";

    private MediaPlayer mediaPlayer;
    private boolean playbackStarted = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate");

        // Keep the CPU awake while playing audio in the background.
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK, "EcoPlayer:BackgroundAudioWakeLock");
            wakeLock.setReferenceCounted(false);
            try {
                wakeLock.acquire(10 * 60 * 1000);
            } catch (Exception e) {
                Log.w(TAG, "Could not acquire wake lock", e);
            }
        }

        mediaPlayer = new MediaPlayer();
        mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
        mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build());
        mediaPlayer.setOnErrorListener(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand");
        // Show the foreground notification so the OS keeps this service alive.
        startForeground(NOTIFICATION_ID, buildNotification());
        if (intent != null && intent.getBooleanExtra("stop", false)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy");
        stopForeground(true);
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        super.onDestroy();
    }

    /** Called by the Capacitor web layer via a plugin when playback begins. */
    public void startPlayback() {
        if (playbackStarted) return;
        playbackStarted = true;
        Log.d(TAG, "startPlayback");
    }

    /** Called by the Capacitor web layer when playback stops. */
    public void stopPlayback() {
        playbackStarted = false;
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer error: what=%d extra=%d", what, extra);
        stopForeground(true);
        stopSelf();
        return true;
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.app_name))
                .setContentText("Playing in background")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setContentIntent(pendingIntent);

        ensureNotificationChannel();
        return builder.build();
    }

    private void ensureNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    CHANNEL_ID,
                    "Background audio",
                    android.app.NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps Eco Player audio playing in the background.");
            channel.setLockscreenVisibility(android.app.NotificationCompat.VISIBILITY_PUBLIC);
            NotificationManagerCompat.from(this).createNotificationChannel(channel);
        }
    }
}
