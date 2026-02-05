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
public final class LoginUseCase_Factory implements Factory<LoginUseCase> {
  @Override
  public LoginUseCase get() {
    return newInstance();
  }

  public static LoginUseCase_Factory create() {
    return InstanceHolder.INSTANCE;
  }

  public static LoginUseCase newInstance() {
    return new LoginUseCase();
  }

  private static final class InstanceHolder {
    static final LoginUseCase_Factory INSTANCE = new LoginUseCase_Factory();
  }
}
