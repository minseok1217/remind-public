package com.example.remind_webapp.ui

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.pm.PackageManager
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
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.remind_webapp.R
import com.example.remind_webapp.util.AlarmHelper
import com.example.remind_webapp.web.WebViewManager
import kotlinx.coroutines.launch
import androidx.core.content.edit
import android.widget.Toast
import android.content.Intent
import android.net.Uri
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.ValueCallback
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private var isOpened = false
    private var backPressedTime: Long = 0
    private lateinit var webViewManager: WebViewManager
    private var startPage: String? = null
    private val PREFS_NAME = "alarm_prefs"
    private val KEY_ALARM_PERMISSION_GRANTED = "alarm_permission_granted"
    private val REQUEST_RECORD_AUDIO_FOR_SPEECH = 2001
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var pendingSpeechStart = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        setContentView(R.layout.activity_main)

        val buttonArea = findViewById<LinearLayout>(R.id.buttonArea)
        val handle = findViewById<TextView>(R.id.handle)

        buttonArea.post {
            buttonArea.translationX = buttonArea.width.toFloat()
        }

        handle.setOnClickListener {
            if (isOpened) {
                buttonArea.animate()
                    .translationX(buttonArea.width.toFloat())
                    .setDuration(300)
                    .start()
                handle.text = "❮"
            } else {
                buttonArea.animate()
                    .translationX(0f)
                    .setDuration(300)
                    .start()
                handle.text = "❯" }
            isOpened = !isOpened
        }

        startPage = intent.getStringExtra("START_PAGE")

        val webView = findViewById<WebView>(R.id.webView)
        webViewManager = WebViewManager(this, webView)
        webViewManager.init()

        webView.addJavascriptInterface(WebAppBridge(), "AndroidBridge")
        webView.addJavascriptInterface(AndroidSpeechBridge(), "AndroidSpeechBridge")
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = true
        webView.settings.setSupportMultipleWindows(true)

        webView.settings.javaScriptEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.domStorageEnabled = true

        startPage = startPage ?: ""

        webViewManager.loadStartPage(page = "https://remind-aa99f.web.app")

        onBackPressedDispatcher.addCallback(this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {

                    val webView = webViewManager.getWebView()

                    // 웹뷰 뒤로갈 페이지 있으면 웹 뒤로가기
                    if (webView.canGoBack()) {
                        webView.goBack()
                        return
                    }

                    // 앱 종료 처리
                    val currentTime = System.currentTimeMillis()

                    if (currentTime - backPressedTime < 2000) {
                        finish()
                    } else {
                        backPressedTime = currentTime

                        Toast.makeText(
                            this@MainActivity,
                            "한 번 더 누르면 종료됩니다.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        )

        val b1 = findViewById<android.widget.Button>(R.id.b1)
        val b2 = findViewById<android.widget.Button>(R.id.b2)
        val b3 = findViewById<android.widget.Button>(R.id.b3)

        b1.setOnClickListener {
            Log.d("TEST_LOG", "b1 클릭")
            val jsCode = "window.openKMMSEScreenPage()"
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }

        b2.setOnClickListener {
            Log.d("TEST_LOG", "b2 클릭")
            val jsCode = "window.openOrientationTrainingScreenPage2()"
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }

        b3.setOnClickListener {
            Log.d("TEST_LOG", "b3 클릭")
            val jsCode = "window.openVoiceChatScreenPage2()"
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }

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

    inner class AndroidSpeechBridge : RecognitionListener {
        @JavascriptInterface
        fun startListening() {
            Log.d("TESTLOG_SPEECH", "AndroidSpeechBridge.startListening called")
            runOnUiThread {
                startNativeSpeechRecognition()
            }
        }

        @JavascriptInterface
        fun stopListening() {
            Log.d("TESTLOG_SPEECH", "AndroidSpeechBridge.stopListening called")
            runOnUiThread {
                stopNativeSpeechRecognition()
            }
        }

        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            Log.d("TESTLOG_SPEECH", "partial result: $text")
            if (text.isNotBlank()) {
                evaluateSpeechCallback("__androidSpeechOnTranscript", text)
            }
        }

        override fun onResults(results: Bundle?) {
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            Log.d("TESTLOG_SPEECH", "final result: $text")

            if (text.isNotBlank()) {
                evaluateSpeechCallback("__androidSpeechOnResult", text)
            } else {
                evaluateSpeechNoResult()
            }
        }

        override fun onError(error: Int) {
            val label = speechErrorLabel(error)
            Log.w("TESTLOG_SPEECH", "SpeechRecognizer error: $error ($label)")
            evaluateSpeechError(error, label)
        }

        private fun evaluateSpeechCallback(callbackName: String, text: String) {
            val jsCode = "if (window.$callbackName) window.$callbackName(${JSONObject.quote(text)})"
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }

        private fun evaluateSpeechNoResult() {
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(
                    "if (window.__androidSpeechOnNoResult) window.__androidSpeechOnNoResult()",
                    null
                )
            }
        }

        private fun evaluateSpeechError(error: Int, label: String) {
            val jsCode = "if (window.__androidSpeechOnError) window.__androidSpeechOnError($error, ${JSONObject.quote(label)})"
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
        }

        private fun speechErrorLabel(error: Int): String =
            when (error) {
                SpeechRecognizer.ERROR_AUDIO -> "ERROR_AUDIO"
                SpeechRecognizer.ERROR_CLIENT -> "ERROR_CLIENT"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "ERROR_INSUFFICIENT_PERMISSIONS"
                SpeechRecognizer.ERROR_NETWORK -> "ERROR_NETWORK"
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ERROR_NETWORK_TIMEOUT"
                SpeechRecognizer.ERROR_NO_MATCH -> "ERROR_NO_MATCH"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ERROR_RECOGNIZER_BUSY"
                SpeechRecognizer.ERROR_SERVER -> "ERROR_SERVER"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ERROR_SPEECH_TIMEOUT"
                else -> "ERROR_UNKNOWN"
            }
    }

    private fun startNativeSpeechRecognition() {
        Log.d("TESTLOG_SPEECH", "startNativeSpeechRecognition")
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Log.w("TESTLOG_SPEECH", "RECORD_AUDIO permission is not granted. Requesting permission.")
            pendingSpeechStart = true
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                REQUEST_RECORD_AUDIO_FOR_SPEECH
            )
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w("TESTLOG_SPEECH", "SpeechRecognizer is not available")
            webViewManager.getWebView().evaluateJavascript(
                "if (window.__androidSpeechOnNoResult) window.__androidSpeechOnNoResult()",
                null
            )
            return
        }

        stopNativeSpeechRecognition()

        val recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer = recognizer
        recognizer.setRecognitionListener(AndroidSpeechBridge())

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ko-KR")
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2500L)
        }

        recognizer.startListening(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECORD_AUDIO_FOR_SPEECH) return

        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        Log.d("TESTLOG_SPEECH", "RECORD_AUDIO permission result: $granted")
        if (granted && pendingSpeechStart) {
            pendingSpeechStart = false
            startNativeSpeechRecognition()
        } else {
            pendingSpeechStart = false
            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(
                    "if (window.__androidSpeechOnError) window.__androidSpeechOnError(9, 'ERROR_INSUFFICIENT_PERMISSIONS')",
                    null
                )
            }
        }
    }

    private fun stopNativeSpeechRecognition() {
        Log.d("TESTLOG_SPEECH", "stopNativeSpeechRecognition")
        speechRecognizer?.apply {
            try { stopListening() } catch (_: Exception) {}
            try { cancel() } catch (_: Exception) {}
            try { destroy() } catch (_: Exception) {}
        }
        speechRecognizer = null
    }

    private fun openStartPage() {
        if (startPage == "VoiceChatScreen") {
            startPage = null
            intent.removeExtra("START_PAGE")

            val jsCode = "window.openVoiceChatScreenPage()"

            webViewManager.getWebView().post {
                webViewManager.getWebView().evaluateJavascript(jsCode, null)
            }
            Log.d("TESTLOG", "실행했음 ㅇㅇ")
        }
    }

    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == 100) {

            val results =
                if (resultCode == RESULT_OK && data != null) {
                    arrayOf(data.data!!)
                } else {
                    null
                }

            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
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

    override fun onDestroy() {
        stopNativeSpeechRecognition()
        super.onDestroy()
    }
}
