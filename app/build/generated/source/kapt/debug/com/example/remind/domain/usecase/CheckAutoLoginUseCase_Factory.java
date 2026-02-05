package com.example.remind.domain.usecase;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
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
public final class CheckAutoLoginUseCase_Factory implements Factory<CheckAutoLoginUseCase> {
  @Override
  public CheckAutoLoginUseCase get() {
    return newInstance();
  }

  public static CheckAutoLoginUseCase_Factory create() {
    return InstanceHolder.INSTANCE;
  }

  public static CheckAutoLoginUseCase newInstance() {
    return new CheckAutoLoginUseCase();
  }

  private static final class InstanceHolder {
    static final CheckAutoLoginUseCase_Factory INSTANCE = new CheckAutoLoginUseCase_Factory();
  }
}
