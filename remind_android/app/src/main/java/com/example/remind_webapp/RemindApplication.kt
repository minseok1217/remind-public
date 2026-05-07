package com.example.remind_webapp

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.FirebaseApp

class RemindApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        createAlarmChannel()
        FirebaseApp.initializeApp(this)
    }

    private fun createAlarmChannel() {

        val channel = NotificationChannel(
            ALARM_CHANNEL_ID,
            "Alarm Channel",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alarm notifications"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val ALARM_CHANNEL_ID = "alarm_channel"
    }
}
