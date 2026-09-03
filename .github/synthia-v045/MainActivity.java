package world.synthia.r2116;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
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

import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final String UI_URL = "http://127.0.0.1:6969/studio/apps/mobile-linux/";
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView webView;
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        buildUi();
        Intent runtime = new Intent(this, SynthiaRuntimeService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(runtime); else startService(runtime);
        new Thread(this::waitForServer, "synthia-ui-wait").start();
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(9, 9, 12));
        webView = new WebView(this);
        webView.setVisibility(View.GONE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        status = new TextView(this);
        status.setText("Starting Synthia…");
        status.setTextColor(Color.WHITE);
        status.setTextSize(18f);
        status.setGravity(Gravity.CENTER);
        status.setPadding(40, 40, 40, 40);
        root.addView(status, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
    }

    private void waitForServer() {
        long deadline = System.currentTimeMillis() + 60000L;
        Exception last = null;
        while (System.currentTimeMillis() < deadline) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(UI_URL).openConnection();
                connection.setConnectTimeout(900);
                connection.setReadTimeout(900);
                connection.setUseCaches(false);
                int code = connection.getResponseCode();
                if (code >= 200 && code < 500) {
                    main.post(() -> {
                        status.setVisibility(View.GONE);
                        webView.setVisibility(View.VISIBLE);
                        webView.loadUrl(UI_URL);
                    });
                    return;
                }
            } catch (Exception error) { last = error; }
            finally { if (connection != null) connection.disconnect(); }
            try { Thread.sleep(300L); } catch (InterruptedException ignored) { return; }
        }
        final String detail = last == null ? "Local server did not answer." : last.getMessage();
        main.post(() -> status.setText("Synthia's residence did not open.\n\n" + detail + "\n\nClose and reopen the app. Her persistent state has not been deleted."));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.getVisibility() == View.VISIBLE && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
