package world.synthia.r2116;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class SynthiaRuntimeService extends Service {
    private static final String CHANNEL_ID = "synthia-runtime";
    private static final int NOTIFICATION_ID = 40501;
    private static final String PAYLOAD_ASSET = "synthia-v045.zip";
    private static final String PAYLOAD_SHA256 = "@@PAYLOAD_SHA256@@";
    private static final AtomicBoolean NODE_STARTED = new AtomicBoolean(false);

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Synthia is starting"));
        new Thread(this::bootRuntime, "synthia-runtime-service").start();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!NODE_STARTED.get()) new Thread(this::bootRuntime, "synthia-runtime-retry").start();
        return START_STICKY;
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private void bootRuntime() {
        if (!NODE_STARTED.compareAndSet(false, true)) return;
        try {
            File residence = ensureResidence();
            File launcher = ensureLauncher();
            File data = new File(getFilesDir(), "synthia-data");
            File state = new File(getFilesDir(), "synthia-state");
            File watch = new File(getFilesDir(), "synthia-watch");
            File sandbox = new File(getFilesDir(), "synthia-sandbox");
            for (File dir : new File[]{data,state,watch,sandbox}) if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) throw new Exception("Cannot create " + dir);
            updateNotification("Synthia runtime online");
            int code = NodeRuntime.startNodeWithArguments(new String[]{
                "node", launcher.getAbsolutePath(), residence.getAbsolutePath(),
                data.getAbsolutePath(), state.getAbsolutePath(), watch.getAbsolutePath(), sandbox.getAbsolutePath()
            });
            NODE_STARTED.set(false);
            updateNotification("Synthia runtime stopped (" + code + ")");
        } catch (Throwable error) {
            NODE_STARTED.set(false);
            updateNotification("Synthia runtime error");
            error.printStackTrace();
        }
    }

    private File ensureResidence() throws Exception {
        File residence = new File(getFilesDir(), "synthia-residence");
        File marker = new File(residence, ".payload-sha256");
        File server = new File(residence, "server.js");
        if (server.isFile() && marker.isFile()) {
            String current = new String(java.nio.file.Files.readAllBytes(marker.toPath()), StandardCharsets.UTF_8).trim();
            if (PAYLOAD_SHA256.equalsIgnoreCase(current)) return residence;
        }
        if (residence.exists()) deleteRecursively(residence);
        if (!residence.mkdirs() && !residence.isDirectory()) throw new Exception("Cannot create Synthia residence");
        String actual = assetSha256(PAYLOAD_ASSET);
        if (!PAYLOAD_SHA256.equalsIgnoreCase(actual)) throw new SecurityException("Bundled Synthia payload checksum mismatch");
        unzipAsset(PAYLOAD_ASSET, residence);
        if (!server.isFile()) throw new Exception("server.js missing after residence extraction");
        try (FileOutputStream out = new FileOutputStream(marker)) { out.write(PAYLOAD_SHA256.getBytes(StandardCharsets.UTF_8)); }
        return residence;
    }

    private File ensureLauncher() throws Exception {
        File dir = new File(getFilesDir(), "synthia-launcher");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create launcher directory");
        File launcher = new File(dir, "wrapper-launcher.cjs");
        try (InputStream in = getAssets().open("wrapper-launcher.cjs"); FileOutputStream out = new FileOutputStream(launcher)) {
            byte[] buffer = new byte[32768];
            for (int n; (n = in.read(buffer)) > 0;) out.write(buffer, 0, n);
        }
        return launcher;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Synthia Runtime", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps Synthia's local residence and sync runtime alive.");
            manager.createNotificationChannel(channel);
        }
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        return builder.setContentTitle("Synthia").setContentText(text).setSmallIcon(android.R.drawable.stat_notify_sync_noanim).setContentIntent(pending).setOngoing(true).build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, notification(text));
    }

    private String assetSha256(String asset) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new BufferedInputStream(getAssets().open(asset))) {
            byte[] buffer = new byte[65536];
            for (int n; (n = in.read(buffer)) > 0;) digest.update(buffer, 0, n);
        }
        StringBuilder out = new StringBuilder();
        for (byte b : digest.digest()) out.append(String.format(Locale.US, "%02x", b & 0xff));
        return out.toString();
    }

    private void unzipAsset(String asset, File target) throws Exception {
        String root = target.getCanonicalPath() + File.separator;
        try (ZipInputStream zin = new ZipInputStream(new BufferedInputStream(getAssets().open(asset)))) {
            ZipEntry entry; byte[] buffer = new byte[65536];
            while ((entry = zin.getNextEntry()) != null) {
                File outFile = new File(target, entry.getName());
                String canonical = outFile.getCanonicalPath();
                if (!canonical.startsWith(root)) throw new SecurityException("Unsafe ZIP path: " + entry.getName());
                if (entry.isDirectory()) {
                    if (!outFile.exists() && !outFile.mkdirs()) throw new Exception("Cannot create " + outFile);
                } else {
                    File parent = outFile.getParentFile();
                    if (parent != null && !parent.exists() && !parent.mkdirs()) throw new Exception("Cannot create " + parent);
                    try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(outFile))) {
                        for (int n; (n = zin.read(buffer)) > 0;) out.write(buffer, 0, n);
                    }
                }
                zin.closeEntry();
            }
        }
    }

    private void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        if (!file.delete() && file.exists()) throw new RuntimeException("Cannot remove " + file);
    }
}
