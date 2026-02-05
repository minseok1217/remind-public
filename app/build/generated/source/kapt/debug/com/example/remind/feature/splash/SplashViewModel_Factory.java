package com.example.remind.feature.splash;

import com.example.remind.domain.usecase.CheckAutoLoginUseCase;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
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
public final class SplashViewModel_Factory implements Factory<SplashViewModel> {
  private final Provider<CheckAutoLoginUseCase> checkAutoLoginUseCaseProvider;

  private SplashViewModel_Factory(Provider<CheckAutoLoginUseCase> checkAutoLoginUseCaseProvider) {
    this.checkAutoLoginUseCaseProvider = checkAutoLoginUseCaseProvider;
  }

  @Override
  public SplashViewModel get() {
    return newInstance(checkAutoLoginUseCaseProvider.get());
  }

  public static SplashViewModel_Factory create(
      Provider<CheckAutoLoginUseCase> checkAutoLoginUseCaseProvider) {
    return new SplashViewModel_Factory(checkAutoLoginUseCaseProvider);
  }

  public static SplashViewModel newInstance(CheckAutoLoginUseCase checkAutoLoginUseCase) {
    return new SplashViewModel(checkAutoLoginUseCase);
  }
}
