package com.example.remind.feature.call.reciver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.remind.feature.call.AlarmActivity

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(alarmIntent)
    }
}
