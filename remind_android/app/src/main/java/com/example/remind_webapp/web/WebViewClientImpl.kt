package com.example.remind_webapp.web

import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.example.remind_webapp.util.UrlPolicy

class WebViewClientImpl : WebViewClient() {

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest
    ): Boolean {

        val url = request.url.toString()

        return !UrlPolicy.isAllowed(url)
    }
}
