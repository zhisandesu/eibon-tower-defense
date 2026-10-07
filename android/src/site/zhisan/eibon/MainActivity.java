package site.zhisan.eibon;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.MimeTypeMap;
import android.graphics.Color;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

/** An offline, sandboxed WebView. Only packaged game assets can be requested. */
public final class MainActivity extends Activity {
    private WebView web;
    private static final String HOST = "appassets.androidplatform.net";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(params);
        immersive();
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(33,28,44));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost()) || !request.getUrl().getPath().startsWith("/game/");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String file = request.getUrl().getPath();
                if (!HOST.equals(request.getUrl().getHost()) || file == null || !file.startsWith("/game/") || file.contains("..") || file.contains("\\")) return missing();
                String extension = MimeTypeMap.getFileExtensionFromUrl(file);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                if ("js".equals(extension)) mime = "application/javascript";
                if (mime == null) mime = "application/octet-stream";
                try {
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open(file.substring(1)));
                } catch (IOException error) { return missing(); }
            }
            private WebResourceResponse missing() {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl("https://" + HOST + "/game/play.html");
    }
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.EibonHost?.setPaused(true)", null);
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); }
        immersive();
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immersive();
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.EibonHost?.setPaused(true)", null);
        new AlertDialog.Builder(this).setTitle("结束值班？").setMessage("已保存的通关记录会保留，当前战斗结束。").setPositiveButton("退出", (dialog, which) -> finish()).setNegativeButton("继续", (dialog, which) -> immersive()).show();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
