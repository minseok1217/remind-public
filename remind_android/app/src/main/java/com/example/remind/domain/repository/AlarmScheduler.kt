package com.example.remind.domain.repository

interface AlarmScheduler {
    fun scheduleAlarm(triggerAtMillis: Long)
}
