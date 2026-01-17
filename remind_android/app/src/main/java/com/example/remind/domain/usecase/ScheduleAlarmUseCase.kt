package com.example.remind.domain.usecase

import com.example.remind.domain.repository.AlarmScheduler

class ScheduleAlarmUseCase(
    private val alarmScheduler: AlarmScheduler
) {
    fun scheduleAlarm(delaySeconds: Int) {
        val triggerTime = System.currentTimeMillis() + delaySeconds * 1000
        alarmScheduler.scheduleAlarm(triggerTime)
    }
}
