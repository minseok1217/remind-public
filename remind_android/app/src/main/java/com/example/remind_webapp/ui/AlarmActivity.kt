package com.example.remind_webapp.ui

import android.app.KeyguardManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.remind_webapp.R
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.app.NotificationManager

class AlarmActivity : AppCompatActivity() {
    private lateinit var keyguardManager: KeyguardManager
    private var mediaPlayer: MediaPlayer? = null
    private val timeoutHandler = Handler(Looper.getMainLooper())
    private val autoRejectRunnable = Runnable {
        stopRingtone()
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val notificationManager =
            getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(1001)
        setContentView(R.layout.activity_alarm)

        setShowWhenLocked(true)
        setTurnScreenOn(true)

        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        startRingtone()

        // 1분 30초 뒤 자동 종료
        timeoutHandler.postDelayed(autoRejectRunnable, 90_000)

        keyguardManager = getSystemService(KEYGUARD_SERVICE) as KeyguardManager

        findViewById<View>(R.id.btn_reject).setOnClickListener {
            stopRingtone()
            finish()
        }

        findViewById<View>(R.id.btn_accept).setOnClickListener {
            stopRingtone()
            handleAccept()
        }
    }

    private fun startRingtone() {
        mediaPlayer = MediaPlayer.create(this, R.raw.galaxy_bells_s21).apply {
            isLooping = true
            start()
        }
    }

    private fun stopRingtone() {
        mediaPlayer?.apply {
            release()
        }

        mediaPlayer = null
    }
    private fun handleAccept() {

        if (keyguardManager.isKeyguardLocked) {

            // 잠금 해제 후 CallActivity 실행 요청
            keyguardManager.requestDismissKeyguard(
                this,
                object : KeyguardManager.KeyguardDismissCallback() {

                    override fun onDismissSucceeded() {
                        openCallActivity()
                    }

                    override fun onDismissCancelled() {
                        // 사용자가 취소한 경우
                    }

                    override fun onDismissError() {
                        // 에러 발생 시 fallback
                        openCallActivity()
                    }
                }
            )

        } else {
            openCallActivity()
        }
    }

    private fun openCallActivity() {

        val intent = Intent(this, SplashActivity::class.java).apply {
            putExtra("START_PAGE", "VoiceChatScreen")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        startActivity(intent)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()

        timeoutHandler.removeCallbacks(autoRejectRunnable)
        stopRingtone()
    }
}
