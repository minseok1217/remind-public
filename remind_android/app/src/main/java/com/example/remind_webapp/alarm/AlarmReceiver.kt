package com.example.remind_webapp.alarm

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.annotation.RequiresPermission
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.remind_webapp.R
import com.example.remind_webapp.RemindApplication
import com.example.remind_webapp.ui.AlarmActivity

class AlarmReceiver : BroadcastReceiver() {

    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    override fun onReceive(context: Context, intent: Intent) {
        val activityIntent = Intent(context, AlarmActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
        }

        context.startActivity(activityIntent)

        Log.d("TESTLOG", "AlarmReceiver onReceive called")

        val fullScreenIntent = Intent(context, AlarmActivity::class.java)

        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
            context,
            RemindApplication.ALARM_CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_logo)   // 필수
            .setContentTitle("Remind")
            .setContentText("대화하시려면 클릭하세요!")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context)
            .notify(1001, notification)

        // 다음 알람 재등록
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager

        val prefs = context.getSharedPreferences("alarm_prefs", Context.MODE_PRIVATE)
        val time = prefs.getString("alarm_time", "12:00") ?: "12:00"

        val parts = time.split(":")
        if (parts.size == 2) {
            val hour = parts[0].toIntOrNull() ?: 12
            val minute = parts[1].toIntOrNull() ?: 0

            Log.d("TESTLOG", "다음날 알람 재등록: $hour:$minute")

            com.example.remind_webapp.util.AlarmHelper.scheduleAlarm(
                context,
                alarmManager,
                hour,
                minute
            )
        }
    }
}
