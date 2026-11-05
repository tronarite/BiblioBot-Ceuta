package net.tronarite.bibliobot;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import android.content.res.ColorStateList;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.progressindicator.LinearProgressIndicator;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER = 1;
    private static final String PREFS = "bibliobot";
    private static final String PREF_DARK = "dark";

    // Pestañas nativas: ruta de la web, texto, icono
    private static final String[] TAB_PATHS = {"/dashboard", "/programaciones", "/amigos", "/cuenta"};
    private static final int[] TAB_LABELS = {R.string.tab_dashboard, R.string.tab_programaciones, R.string.tab_amigos, R.string.tab_cuenta};
    private static final int[] TAB_ICONS = {R.drawable.ic_tab_home, R.drawable.ic_tab_calendar, R.drawable.ic_tab_people, R.drawable.ic_tab_person};

    private LinearLayout root;
    private WebView webView;
    private SwipeRefreshLayout refresh;
    private LinearProgressIndicator progress;
    private View errorView;
    private TextView errorMsg;
    private LinearLayout bottomNav;          // contenedor (pinta bajo la barra de gestos)
    private BottomNavigationView navBar;     // NavigationBar de Material 3
    private boolean settingTab;
    private boolean pullRefreshEnabled = true;

    private ValueCallback<Uri[]> fileCallback;
    private boolean loadFailed;
    private boolean dark;
    private int currentTab = -1;
    private boolean routeHasNav;
    private Insets bars = Insets.NONE;
    private int imeBottom;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean systemDark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        dark = prefs.getBoolean(PREF_DARK, systemDark);

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        // Zona web (con barra de progreso fina encima)
        FrameLayout webFrame = new FrameLayout(this);
        webView = new WebView(this);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        refresh = new SwipeRefreshLayout(this);
        refresh.addView(webView);
        refresh.setOnChildScrollUpCallback((parent, child) -> webView.getScrollY() > 0);
        webFrame.addView(refresh, new FrameLayout.LayoutParams(-1, -1));

        progress = new LinearProgressIndicator(this);
        progress.setVisibility(View.GONE);
        webFrame.addView(progress, new FrameLayout.LayoutParams(-1, dp(3)));

        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        webFrame.addView(errorView, new FrameLayout.LayoutParams(-1, -1));

        root.addView(webFrame, new LinearLayout.LayoutParams(-1, 0, 1f));

        bottomNav = buildBottomNav();
        root.addView(bottomNav, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets sb = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            bars = sb;
            imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
            applyLayout();
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // La web detecta la app por este sufijo y oculta su menú móvil (la navegación es nativa)
        s.setUserAgentString(s.getUserAgentString() + " BiblioBotApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new Bridge(), "BiblioBotNative");

        refresh.setOnRefreshListener(() -> webView.reload());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && BuildConfig.APP_HOST.equals(uri.getHost())) {
                    return false; // se queda dentro de la app
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loadFailed = false;
                // Una página nueva vuelve a permitir tirar para refrescar (la web lo desactiva en sus asistentes).
                pullRefreshEnabled = true;
                refresh.setEnabled(true);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                updateRoute(url); // también salta con las navegaciones internas de la SPA
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                refresh.setRefreshing(false);
                errorView.setVisibility(loadFailed ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loadFailed = true;
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        applyTheme();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(startUrl(getIntent()));
        }
    }

    // ---------- Puente JS -> nativo ----------
    private class Bridge {
        /** La web lo desactiva dentro de los asistentes (su scroll es interno y el gesto recargaba la página). */
        @JavascriptInterface
        public void setPullRefresh(boolean enabled) {
            runOnUiThread(() -> {
                pullRefreshEnabled = enabled;
                refresh.setEnabled(enabled);
            });
        }

        @JavascriptInterface
        public void setTheme(boolean isDark) {
            runOnUiThread(() -> {
                if (dark == isDark) return;
                dark = isDark;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_DARK, isDark).apply();
                applyTheme();
            });
        }
    }

    // ---------- Tema, márgenes y barra inferior ----------
    private int surface() { return dark ? 0xFF1E293B : 0xFFFFFFFF; }       // = cabecera de la web
    private int pageBg()  { return dark ? 0xFF0F172A : 0xFFF8FAFC; }
    private int navBg()   { return dark ? 0xFF1B2433 : 0xFFF1F4FB; }       // surface container M3
    private int tabOn()   { return dark ? 0xFF8AB4FF : 0xFF1D69EF; }
    private int tabOff()  { return dark ? 0xFF94A3B8 : 0xFF64748B; }

    private void applyTheme() {
        root.setBackgroundColor(surface());
        webView.setBackgroundColor(pageBg());
        bottomNav.setBackgroundColor(navBg());
        navBar.setBackgroundColor(navBg());
        navBar.setItemActiveIndicatorColor(ColorStateList.valueOf(dark ? 0xFF1F3F85 : 0xFFD9E2FF));
        ColorStateList tint = new ColorStateList(
                new int[][]{{android.R.attr.state_checked}, {}},
                new int[]{dark ? 0xFFD9E2FF : 0xFF001945, tabOff()});
        navBar.setItemIconTintList(tint);
        navBar.setItemTextColor(tint);
        errorView.setBackgroundColor(pageBg());
        errorMsg.setTextColor(dark ? 0xFFCBD5E1 : Color.DKGRAY);
        progress.setIndicatorColor(tabOn());
        refresh.setProgressBackgroundColorSchemeColor(surface());
        refresh.setColorSchemeColors(tabOn());
        // Iconos de la barra de estado/navegación legibles sobre el fondo
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), root);
        c.setAppearanceLightStatusBars(!dark);
        c.setAppearanceLightNavigationBars(!dark);
        getWindow().getDecorView().setBackgroundColor(surface());
        refreshTabs();
    }

    private void applyLayout() {
        boolean imeVisible = imeBottom > bars.bottom;
        boolean showNav = routeHasNav && !imeVisible;
        bottomNav.setVisibility(showNav ? View.VISIBLE : View.GONE);
        int bottom = imeVisible ? imeBottom : bars.bottom;
        if (showNav) {
            root.setPadding(bars.left, bars.top, bars.right, 0);
            bottomNav.setPadding(0, 0, 0, bottom);
        } else {
            root.setPadding(bars.left, bars.top, bars.right, bottom);
            bottomNav.setPadding(0, 0, 0, 0);
        }
    }

    private LinearLayout buildBottomNav() {
        LinearLayout box = new LinearLayout(this);
        navBar = new BottomNavigationView(this);
        navBar.inflateMenu(R.menu.bottom_nav);
        navBar.setLabelVisibilityMode(BottomNavigationView.LABEL_VISIBILITY_LABELED);
        navBar.setOnItemSelectedListener(item -> {
            if (!settingTab) {
                navBar.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                goToTab(tabIndex(item.getItemId()));
            }
            return true;
        });
        navBar.setOnItemReselectedListener(item -> goToTab(tabIndex(item.getItemId())));
        box.addView(navBar, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT));
        return box;
    }

    private int tabIndex(int menuId) {
        int[] ids = {R.id.tab_0, R.id.tab_1, R.id.tab_2, R.id.tab_3};
        for (int i = 0; i < ids.length; i++) if (ids[i] == menuId) return i;
        return 0;
    }

    private void refreshTabs() {
        if (currentTab < 0) return;
        int[] ids = {R.id.tab_0, R.id.tab_1, R.id.tab_2, R.id.tab_3};
        settingTab = true;
        navBar.setSelectedItemId(ids[currentTab]);
        settingTab = false;
    }

    /** Navegación interna de la SPA (React Router escucha popstate), sin recargar la página. */
    private void goToTab(int idx) {
        if (idx == currentTab) {
            webView.scrollTo(0, 0);
            webView.evaluateJavascript("window.scrollTo(0,0)", null);
            return;
        }
        String path = TAB_PATHS[idx];
        webView.evaluateJavascript(
                "history.pushState({}, '', '" + path + "');window.dispatchEvent(new PopStateEvent('popstate'));", null);
    }

    private void updateRoute(String url) {
        Uri u = Uri.parse(url);
        String p = u.getPath() == null ? "" : u.getPath();
        int tab = -1;
        for (int i = 0; i < TAB_PATHS.length; i++) {
            if (p.equals(TAB_PATHS[i]) || p.startsWith(TAB_PATHS[i] + "/")) tab = i;
        }
        currentTab = tab;
        routeHasNav = tab >= 0;
        refreshTabs();
        applyLayout();
    }

    // ---------- Resto ----------
    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private String startUrl(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null && "https".equals(data.getScheme()) && BuildConfig.APP_HOST.equals(data.getHost())) {
            return data.toString();
        }
        return BuildConfig.APP_URL;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        webView.loadUrl(startUrl(intent));
    }

    private View buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorMsg = new TextView(this);
        errorMsg.setText(R.string.sin_conexion);
        errorMsg.setTextSize(16);
        errorMsg.setGravity(Gravity.CENTER);
        MaterialButton retry = new MaterialButton(this);
        retry.setText(R.string.reintentar);
        retry.setOnClickListener(v -> {
            errorView.setVisibility(View.GONE);
            webView.loadUrl(BuildConfig.APP_URL);
        });
        box.addView(errorMsg);
        box.addView(retry);
        return box;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
