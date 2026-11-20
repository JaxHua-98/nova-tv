package com.nova.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView web;
    private LocalServer server;
    private boolean pageReady = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        goFullscreen();

        web = new WebView(this);
        web.setBackgroundColor(0xFF07080F);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
            }
        });

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        setContentView(web);

        // 先在随机端口起本地服务，再加载它：保证 /api/proxy 与 WebAudio 同源
        String pair = String.format(java.util.Locale.US, "%04d", (int) (Math.random() * 10000));
        server = new LocalServer(getAssets(), pair, new LocalServer.PortListener() {
            @Override
            public void onPort(final int port) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        web.loadUrl("http://127.0.0.1:" + port + "/index.html");
                    }
                });
            }
        });
        server.start();
    }

    private void goFullscreen() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goFullscreen();
    }

    /** 返回键：先交给页面逐级返回（派发 Escape），页面在首页时再退出应用 */
    @Override
    public boolean onKeyDown(int code, KeyEvent event) {
        if (code == KeyEvent.KEYCODE_BACK) {
            if (pageReady) {
                web.evaluateJavascript(
                        "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));",
                        null);
            }
            return true;
        }
        // 菜单键 / 媒体键转成页面认得的键
        if (code == KeyEvent.KEYCODE_MENU) {
            if (pageReady) {
                web.evaluateJavascript(
                        "document.dispatchEvent(new KeyboardEvent('keydown',{key:'ContextMenu',bubbles:true,cancelable:true}));",
                        null);
            }
            return true;
        }
        return super.onKeyDown(code, event);
    }

    /** 长按返回 = 直接退出（电视上常规做法） */
    @Override
    public boolean onKeyLongPress(int code, KeyEvent event) {
        if (code == KeyEvent.KEYCODE_BACK) {
            finish();
            return true;
        }
        return super.onKeyLongPress(code, event);
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.shutdown();
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
        }
        super.onDestroy();
    }
}
