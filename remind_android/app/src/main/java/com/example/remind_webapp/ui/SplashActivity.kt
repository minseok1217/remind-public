package com.example.remind_webapp.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.example.remind_webapp.R
import android.content.Context
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        instance = this

        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_splash)

        permissionRequest()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == 1000) {
            if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                handleSplashFlow()
            } else {
                finishAffinity()
            }
        }
    }

    private fun permissionRequest() {
        val permissions = mutableListOf<String>()

        // 🔔 알림 권한
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // 🎤 마이크 권한
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(android.Manifest.permission.RECORD_AUDIO)
        }

        if (permissions.isNotEmpty()) {
            requestPermissions(permissions.toTypedArray(), 1000)
        } else {
            handleSplashFlow()
        }
    }

    private fun handleSplashFlow() {
        requestIgnoreBatteryOptimization()

        lifecycleScope.launch {
            navigateToMain()
        }
    }

    private fun navigateToMain() {
        val startPage = intent.getStringExtra("START_PAGE")

        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("START_PAGE", startPage)
        }
        startActivity(intent)
    }

    private fun requestIgnoreBatteryOptimization() {

        val powerManager =
            getSystemService(Context.POWER_SERVICE) as PowerManager

        val packageName = packageName

        if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {

            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName")
            )

            startActivity(intent)
        }
    }

    companion object {
        var instance: SplashActivity? = null
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
