package com.example.remind_webapp.ui

import android.app.AlarmManager
import android.content.Context
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.edit
import com.example.remind_webapp.R
import com.example.remind_webapp.util.AlarmHelper

class TimeSettingActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_time_setting)

        intent.getStringExtra("time")?.let { time ->
            val parts = time.split(":")
            if (parts.size == 2) {
                val hour = parts[0].toIntOrNull() ?: 0
                val minute = parts[1].toIntOrNull() ?: 0

                // 알람 예약 (권한 체크 포함)
                val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
                AlarmHelper.checkExactAlarmPermission(this, alarmManager) {
                    // 권한 확인 완료 → 알람 예약
                    AlarmHelper.scheduleAlarm(this, alarmManager, hour, minute)
                }

                finish()
            }
        }
    }
}
