package com.example.remind.feature.call.di;

import com.example.remind.domain.repository.AlarmScheduler;
import com.example.remind.domain.usecase.ScheduleAlarmUseCase;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;

@ScopeMetadata
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava",
    "cast",
    "deprecation",
    "nullness:initialization.field.uninitialized"
})
public final class AlarmModule_ProvideScheduleAlarmUseCaseFactory implements Factory<ScheduleAlarmUseCase> {
  private final Provider<AlarmScheduler> schedulerProvider;

  private AlarmModule_ProvideScheduleAlarmUseCaseFactory(
      Provider<AlarmScheduler> schedulerProvider) {
    this.schedulerProvider = schedulerProvider;
  }

  @Override
  public ScheduleAlarmUseCase get() {
    return provideScheduleAlarmUseCase(schedulerProvider.get());
  }

  public static AlarmModule_ProvideScheduleAlarmUseCaseFactory create(
      Provider<AlarmScheduler> schedulerProvider) {
    return new AlarmModule_ProvideScheduleAlarmUseCaseFactory(schedulerProvider);
  }

  public static ScheduleAlarmUseCase provideScheduleAlarmUseCase(AlarmScheduler scheduler) {
    return Preconditions.checkNotNullFromProvides(AlarmModule.INSTANCE.provideScheduleAlarmUseCase(scheduler));
  }
}
