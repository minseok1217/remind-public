package com.example.remind_webapp.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.remind_webapp.R
import com.example.remind_webapp.ui.TimeSettingActivity
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TimeMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "time_alarm_channel"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.data["time"]?.let { time ->
            sendNotification(time)
        }
    }

    private fun sendNotification(time: String) {
        createNotificationChannel()

        val intent = Intent(this, TimeSettingActivity::class.java).apply {
            putExtra("time", time)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_logo) // 본인 아이콘으로 변경
            .setContentTitle("보호자가 시간을 설정하였습니다.")
            .setContentText("($time) 알람을 클릭하여 적용하세요.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(1001, builder.build())
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Time Alarm",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "시간 설정 알림 채널"
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    override fun onNewToken(token: String) {
        Log.d("TESTLOG_FCM", "New token: $token")
        // saveTokenToFirestore(token)
    }

    private fun saveTokenToFirestore(token: String) {
        val userId = "로그인된_사용자_ID" // TODO: 실제 UID
        val db = FirebaseFirestore.getInstance()
        val data = hashMapOf("fcmToken" to token)

        db.collection("users").document(userId)
            .set(data)
            .addOnSuccessListener { Log.d("TESTLOG_SplashActivity", "토큰 저장 성공") }
            .addOnFailureListener { e -> Log.w("TESTLOG_SplashActivity", "토큰 저장 실패", e) }
    }
}