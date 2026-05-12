package com.example.remind_webapp.web

import android.app.Activity
import android.util.Log
import android.webkit.WebView
import com.example.remind_webapp.bridge.WebBridge
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient

class WebViewManager(
    private val activity: Activity,
    private val webView: WebView
) {
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1002

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

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                Log.d("TESTLOG", "🔥 permission 요청 들어옴: ${request.resources.joinToString()}")
                request.grant(request.resources)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {

                // 기존 callback 제거
                this@WebViewManager.filePathCallback?.onReceiveValue(null)

                // 새 callback 저장
                this@WebViewManager.filePathCallback = filePathCallback

                return try {

                    // 파일 선택 Intent 생성
                    val intent = fileChooserParams?.createIntent()

                    // 파일 선택창 열기
                    activity.startActivityForResult(
                        intent,
                        FILE_CHOOSER_REQUEST_CODE
                    )

                    true

                } catch (e: Exception) {

                    this@WebViewManager.filePathCallback = null
                    false
                }
            }
        }

        // 웹 브리지 사용 시 : webView.addJavascriptInterface(WebBridge(), "AndroidBridge")
    }

    fun handleFileChooserResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {

        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            return
        }

        val results =
            if (resultCode == Activity.RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(
                    resultCode,
                    data
                )
            } else {
                null
            }

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    fun loadStartPage(page: String, customToken: String? = null) {
        val Url = "https://remind-aa99f.web.app"

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
