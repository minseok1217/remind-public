package com.example.remind_webapp.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.appcompat.app.AlertDialog
import com.example.remind_webapp.alarm.AlarmReceiver
import java.util.*
import androidx.core.content.edit

object AlarmHelper {

    /**
     * 알람 시간 설정
     * day: 오늘 기준 며칠 뒤인지 (기본 0)
     */
    fun scheduleAlarm(context: Context, alarmManager: AlarmManager, hour: Int, minute: Int, day: Int = 0) {

        val prefs = context.getSharedPreferences("alarm_prefs", Context.MODE_PRIVATE)
        prefs.edit { putString("alarm_time", "$hour:$minute") }

        val calendar = Calendar.getInstance().apply {
            timeInMillis = System.currentTimeMillis()
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            add(Calendar.DATE, day)
            if (before(Calendar.getInstance())) {
                add(Calendar.DATE, 1)
            }
        }

        val alarmIntent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            pendingIntent
        )
    }

    /**
     * 정확한 알람 권한 체크 및 요청
     * Build.VERSION_CODES.S 이상에서만 필요
     */
    fun checkExactAlarmPermission(context: Context, alarmManager: AlarmManager, onGranted: () -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                AlertDialog.Builder(context)
                    .setTitle("알람 권한 필요")
                    .setMessage("앱을 사용하려면 정확한 알람 권한을 허용해야 합니다.")
                    .setCancelable(false)
                    .setPositiveButton("설정으로 이동") { _, _ ->
                        context.startActivity(
                            Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                        )
                    }
                    .setNegativeButton("종료") { _, _ ->
                        if (context is android.app.Activity) context.finish()
                    }
                    .show()
                return
            }
        }

        // 권한 있음 → 콜백 실행
        onGranted()
    }
}
