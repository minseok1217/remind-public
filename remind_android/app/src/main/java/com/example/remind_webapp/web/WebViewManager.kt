package com.example.remind_webapp.web

import android.app.Activity
import android.util.Log
import android.webkit.WebView
import com.example.remind_webapp.bridge.WebBridge

class WebViewManager(
    private val activity: Activity,
    private val webView: WebView
) {

    fun init() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true

            mediaPlaybackRequiresUserGesture = false
            databaseEnabled = true
        }

        webView.webViewClient = WebViewClientImpl()

        webView.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                Log.d("TESTLOG", "🔥 permission 요청 들어옴: ${request.resources.joinToString()}")
                request.grant(request.resources)
            }
        }

        // 웹 브리지 사용 시 : webView.addJavascriptInterface(WebBridge(), "AndroidBridge")
    }

    fun loadStartPage(page: String, customToken: String? = null) {
        val Url = "https://remind-aa99f.web.app/$page"

        if (customToken != null) {
            webView.evaluateJavascript(
                "firebase.auth().signInWithCustomToken('$customToken').then(function(){" +
                        "window.location.href='$Url'" +
                        "}).catch(function(err){console.error(err); window.location.href='login.html';});"
            ) {}
        } else {
            webView.loadUrl(Url)
        }
    }

    fun handleBack(onExit: () -> Unit) {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            onExit()
        }
    }

    fun getWebView(): WebView = webView
}
