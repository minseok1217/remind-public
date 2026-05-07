package com.example.remind_webapp.ui

import android.app.AlarmManager
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.example.remind_webapp.R
import com.example.remind_webapp.util.AlarmHelper
import com.example.remind_webapp.web.WebViewManager
import kotlinx.coroutines.launch
import androidx.core.content.edit

class MainActivity : AppCompatActivity() {

    private lateinit var webViewManager: WebViewManager
    private var userType: Int = -1
    private var startPage: String? = null

    private val PREFS_NAME = "alarm_prefs"
    private val KEY_ALARM_PERMISSION_GRANTED = "alarm_permission_granted"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        setContentView(R.layout.activity_main)

        startPage = intent.getStringExtra("START_PAGE")

        val webView = findViewById<WebView>(R.id.webView)
        webViewManager = WebViewManager(this, webView)
        webViewManager.init()

        webView.addJavascriptInterface(WebAppBridge(), "AndroidBridge")

        startPage = startPage ?: "main.html"

        webViewManager.loadStartPage(page = "https://remind-aa99f.web.app")

        onBackPressedDispatcher.addCallback(this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webViewManager.handleBack { finish() }
                }
            }
        )

        SplashActivity.instance?.finish()
    }

    inner class WebAppBridge {
        @JavascriptInterface
        fun setAlarmTimeOnce(time:String) {
            runOnUiThread {
                fetchAndSetAlarmTimeOnce(time)
            }
        }

        @JavascriptInterface
        fun onReady() {
            runOnUiThread {
                fetchFCMTokenAndSend()
                openStartPage()
            }
        }
    }

    private fun openStartPage() {
        if (startPage == "VoiceChatScreen") {
            val jsCode = "window.openVoiceChatScreenPage()"

            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }
    }

    private fun sendFcmTokenToWeb(token: String) {
        val safeToken = token.replace("'", "\\'")
        val jsCode = "window.onReceiveFcmToken('$safeToken')"

        webViewManager.getWebView().post {
            webViewManager.getWebView().evaluateJavascript(jsCode, null)
        }
    }

    private fun fetchFCMTokenAndSend() {
        com.google.firebase.messaging.FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    Log.d("TESTLOG_FCM", "Token: $token")

                    sendFcmTokenToWeb(token)
                } else {
                    Log.e("TESTLOG_FCM", "Failed to get token", task.exception)
                }
            }
    }

    private fun fetchAndSetAlarmTimeOnce(time: String) {
        lifecycleScope.launch {
                try {
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val alreadySet = prefs.getBoolean(KEY_ALARM_PERMISSION_GRANTED, false)

                    // 이미 한 번 설정했으면 아무것도 하지 않음
                    if (alreadySet) {
                        Log.d("TESTLOG_MainActivity", "알람 이미 한 번 설정됨 → 스킵")
                        return@launch
                    }

                    Log.d("TESTLOG_MainActivity", "알람 시간 설정: $time")

                    val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager

                    // 권한 확인 후 알람 설정
                    AlarmHelper.checkExactAlarmPermission(this@MainActivity, alarmManager) {
                        val parts = time.split(":")
                        if (parts.size == 2) {
                            val hour = parts[0].toIntOrNull() ?: 12
                            val minute = parts[1].toIntOrNull() ?: 0
                            AlarmHelper.scheduleAlarm(this@MainActivity, alarmManager, hour, minute)

                            // 한 번 설정 완료 플래그 저장 → 이후에는 실행하지 않음
                            prefs.edit { putBoolean(KEY_ALARM_PERMISSION_GRANTED, true) }
                        }
                    }

                } catch (e: Exception) {
                    Log.e("TESTLOG_MainActivity", "알람 시간 가져오기 실패", e)
                }

        }
    }
}
