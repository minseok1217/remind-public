package com.example.remind.feature.call.di;

import android.content.Context;
import com.example.remind.domain.repository.AlarmScheduler;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;

@ScopeMetadata
@QualifierMetadata("dagger.hilt.android.qualifiers.ApplicationContext")
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
public final class AlarmModule_ProvideAlarmSchedulerFactory implements Factory<AlarmScheduler> {
  private final Provider<Context> contextProvider;

  private AlarmModule_ProvideAlarmSchedulerFactory(Provider<Context> contextProvider) {
    this.contextProvider = contextProvider;
  }

  @Override
  public AlarmScheduler get() {
    return provideAlarmScheduler(contextProvider.get());
  }

  public static AlarmModule_ProvideAlarmSchedulerFactory create(Provider<Context> contextProvider) {
    return new AlarmModule_ProvideAlarmSchedulerFactory(contextProvider);
  }

  public static AlarmScheduler provideAlarmScheduler(Context context) {
    return Preconditions.checkNotNullFromProvides(AlarmModule.INSTANCE.provideAlarmScheduler(context));
  }
}
