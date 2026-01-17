package com.example.remind.feature.call.di

import android.content.Context
import com.example.remind.data.repository.AlarmSchedulerImpl
import com.example.remind.domain.repository.AlarmScheduler
import com.example.remind.domain.usecase.ScheduleAlarmUseCase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object AlarmModule {

    @Provides
    fun provideAlarmScheduler(
        @ApplicationContext context: Context
    ): AlarmScheduler = AlarmSchedulerImpl(context)

    @Provides
    fun provideScheduleAlarmUseCase(
        scheduler: AlarmScheduler
    ): ScheduleAlarmUseCase = ScheduleAlarmUseCase(scheduler)
}
