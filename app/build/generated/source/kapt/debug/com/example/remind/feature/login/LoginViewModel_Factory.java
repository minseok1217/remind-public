package com.example.remind.feature.login;

import com.example.remind.domain.usecase.LoginUseCase;
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
public final class LoginViewModel_Factory implements Factory<LoginViewModel> {
  private final Provider<LoginUseCase> loginUseCaseProvider;

  private LoginViewModel_Factory(Provider<LoginUseCase> loginUseCaseProvider) {
    this.loginUseCaseProvider = loginUseCaseProvider;
  }

  @Override
  public LoginViewModel get() {
    return newInstance(loginUseCaseProvider.get());
  }

  public static LoginViewModel_Factory create(Provider<LoginUseCase> loginUseCaseProvider) {
    return new LoginViewModel_Factory(loginUseCaseProvider);
  }

  public static LoginViewModel newInstance(LoginUseCase loginUseCase) {
    return new LoginViewModel(loginUseCase);
  }
}
