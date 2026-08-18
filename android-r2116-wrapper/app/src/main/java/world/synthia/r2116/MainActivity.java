package world.synthia.r2116;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.graphics.Color;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity {
    private static final String PAYLOAD_ASSET = "synthia-r21.16.zip";
    private static final String PAYLOAD_SHA256 = "178a5e1b1853b93e652070f68006b7d9b15df330512cecaba5c43d5b0dbd0471";
    private static final String UI_URL = "http://127.0.0.1:6969/";
    private static volatile boolean nodeStarted = false;

    static { System.loadLibrary("node"); System.loadLibrary("synthia-jni"); }

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView webView;
    private TextView status;

    public native int startNodeWithArguments(String[] arguments);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        buildUi();
        new Thread(() -> {
            try {
                File residence = ensureResidence();
                File launcher = ensureLauncher();
                startNodeIfNeeded(launcher, residence);
                waitForServer();
                main.post(() -> { status.setVisibility(View.GONE); webView.setVisibility(View.VISIBLE); webView.loadUrl(UI_URL); });
            } catch (Throwable e) {
                String m = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "unknown startup error" : e.getMessage());
                main.post(() -> showFailure(m));
            }
        }, "synthia-bootstrap").start();
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(9,9,12));
        webView = new WebView(this);
        webView.setVisibility(View.GONE);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setWebViewClient(new WebViewClient()); webView.setWebChromeClient(new WebChromeClient());
        root.addView(webView, new FrameLayout.LayoutParams(-1,-1));
        status = new TextView(this); status.setText("Starting Synthia r21.16…"); status.setTextColor(Color.WHITE); status.setTextSize(18f); status.setGravity(Gravity.CENTER); status.setPadding(40,40,40,40);
        root.addView(status, new FrameLayout.LayoutParams(-1,-1)); setContentView(root);
    }

    private File ensureResidence() throws Exception {
        File residence = new File(getFilesDir(), "synthia-r21.16");
        File packageJson = new File(residence, "package.json");
        if (packageJson.isFile()) return residence;
        if (residence.exists()) deleteRecursively(residence);
        if (!residence.mkdirs() && !residence.isDirectory()) throw new Exception("Cannot create Synthia residence");
        String actual = assetSha256(PAYLOAD_ASSET);
        if (!PAYLOAD_SHA256.equalsIgnoreCase(actual)) throw new SecurityException("Bundled r21.16 payload checksum mismatch");
        unzipAsset(PAYLOAD_ASSET, residence);
        if (!packageJson.isFile()) throw new Exception("r21.16 package.json missing after extraction");
        try (FileOutputStream out = new FileOutputStream(new File(residence, ".wrapper-payload-sha256"))) { out.write(PAYLOAD_SHA256.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
        return residence;
    }

    private File ensureLauncher() throws Exception {
        File d = new File(getFilesDir(), "wrapper"); if (!d.exists() && !d.mkdirs()) throw new Exception("Cannot create wrapper directory");
        File launcher = new File(d, "wrapper-launcher.cjs");
        try (InputStream in = getAssets().open("wrapper-launcher.cjs"); FileOutputStream out = new FileOutputStream(launcher)) {
            byte[] b = new byte[32768]; for (int n; (n=in.read(b))>0;) out.write(b,0,n);
        }
        return launcher;
    }

    private synchronized void startNodeIfNeeded(File launcher, File residence) {
        if (nodeStarted) return; nodeStarted = true;
        new Thread(() -> { int code = startNodeWithArguments(new String[]{"node", launcher.getAbsolutePath(), residence.getAbsolutePath()}); if (code != 0) main.post(() -> showFailure("Embedded Node stopped with code " + code)); }, "synthia-node").start();
    }

    private void waitForServer() throws Exception {
        long deadline = System.currentTimeMillis() + 45000L; Exception last = null;
        while (System.currentTimeMillis() < deadline) {
            HttpURLConnection c = null;
            try { c=(HttpURLConnection)new URL(UI_URL).openConnection(); c.setConnectTimeout(800); c.setReadTimeout(800); c.setUseCaches(false); int code=c.getResponseCode(); if (code>=200 && code<500) return; }
            catch(Exception e){ last=e; } finally { if(c!=null)c.disconnect(); }
            Thread.sleep(250L);
        }
        throw new Exception("Synthia did not open port 6969" + (last==null?"":": "+last.getMessage()));
    }

    private String assetSha256(String asset) throws Exception {
        MessageDigest d=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new BufferedInputStream(getAssets().open(asset))){ byte[] b=new byte[65536]; for(int n;(n=in.read(b))>0;) d.update(b,0,n); }
        StringBuilder s=new StringBuilder(); for(byte b:d.digest()) s.append(String.format(Locale.US,"%02x",b&0xff)); return s.toString();
    }

    private void unzipAsset(String asset, File target) throws Exception {
        String root=target.getCanonicalPath()+File.separator;
        try(ZipInputStream zin=new ZipInputStream(new BufferedInputStream(getAssets().open(asset)))){
            ZipEntry e; byte[] b=new byte[65536];
            while((e=zin.getNextEntry())!=null){
                File outFile=new File(target,e.getName()); String canonical=outFile.getCanonicalPath(); if(!canonical.startsWith(root)) throw new SecurityException("Unsafe ZIP path: "+e.getName());
                if(e.isDirectory()){ if(!outFile.exists()&&!outFile.mkdirs()) throw new Exception("Cannot create "+outFile); }
                else { File p=outFile.getParentFile(); if(p!=null&&!p.exists()&&!p.mkdirs()) throw new Exception("Cannot create "+p); try(BufferedOutputStream out=new BufferedOutputStream(new FileOutputStream(outFile))){ for(int n;(n=zin.read(b))>0;) out.write(b,0,n); } }
                zin.closeEntry();
            }
        }
    }

    private void deleteRecursively(File f){ if(f.isDirectory()){ File[] kids=f.listFiles(); if(kids!=null) for(File k:kids) deleteRecursively(k); } if(!f.delete()&&f.exists()) throw new RuntimeException("Cannot remove "+f); }
    private void showFailure(String message){ webView.setVisibility(View.GONE); status.setVisibility(View.VISIBLE); status.setText("Synthia could not start.\n\n"+message+"\n\nClose the app completely and open it once more. Existing residence files are preserved."); }
    @Override public void onBackPressed(){ if(webView!=null&&webView.getVisibility()==View.VISIBLE&&webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
