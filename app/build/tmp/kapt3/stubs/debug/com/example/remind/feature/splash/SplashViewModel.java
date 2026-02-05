package com.example.remind.feature.splash;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000,\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0002\b\u0002\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010\f\u001a\u00020\rH\u0086@\u00a2\u0006\u0002\u0010\u000eR\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\b\u001a\b\u0012\u0004\u0012\u00020\u00070\t\u00a2\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000b\u00a8\u0006\u000f"}, d2 = {"Lcom/example/remind/feature/splash/SplashViewModel;", "Landroidx/lifecycle/ViewModel;", "checkAutoLoginUseCase", "Lcom/example/remind/domain/usecase/CheckAutoLoginUseCase;", "(Lcom/example/remind/domain/usecase/CheckAutoLoginUseCase;)V", "_event", "Lkotlinx/coroutines/flow/MutableSharedFlow;", "Lcom/example/remind/feature/splash/SplashEvent;", "event", "Lkotlinx/coroutines/flow/SharedFlow;", "getEvent", "()Lkotlinx/coroutines/flow/SharedFlow;", "checkAutoLogin", "", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class SplashViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.example.remind.domain.usecase.CheckAutoLoginUseCase checkAutoLoginUseCase = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableSharedFlow<com.example.remind.feature.splash.SplashEvent> _event = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.SharedFlow<com.example.remind.feature.splash.SplashEvent> event = null;
    
    @javax.inject.Inject()
    public SplashViewModel(@org.jetbrains.annotations.NotNull()
    com.example.remind.domain.usecase.CheckAutoLoginUseCase checkAutoLoginUseCase) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.SharedFlow<com.example.remind.feature.splash.SplashEvent> getEvent() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object checkAutoLogin(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
}