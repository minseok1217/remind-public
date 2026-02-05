package com.example.remind.feature.splash;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0016\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\b7\u0018\u00002\u00020\u0001:\u0002\u0003\u0004B\u0007\b\u0004\u00a2\u0006\u0002\u0010\u0002\u0082\u0001\u0002\u0005\u0006\u00a8\u0006\u0007"}, d2 = {"Lcom/example/remind/feature/splash/SplashEvent;", "", "()V", "NavigateHome", "NavigateLogin", "Lcom/example/remind/feature/splash/SplashEvent$NavigateHome;", "Lcom/example/remind/feature/splash/SplashEvent$NavigateLogin;", "app_debug"})
public abstract class SplashEvent {
    
    private SplashEvent() {
        super();
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c7\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/example/remind/feature/splash/SplashEvent$NavigateHome;", "Lcom/example/remind/feature/splash/SplashEvent;", "()V", "app_debug"})
    public static final class NavigateHome extends com.example.remind.feature.splash.SplashEvent {
        @org.jetbrains.annotations.NotNull()
        public static final com.example.remind.feature.splash.SplashEvent.NavigateHome INSTANCE = null;
        
        private NavigateHome() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c7\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/example/remind/feature/splash/SplashEvent$NavigateLogin;", "Lcom/example/remind/feature/splash/SplashEvent;", "()V", "app_debug"})
    public static final class NavigateLogin extends com.example.remind.feature.splash.SplashEvent {
        @org.jetbrains.annotations.NotNull()
        public static final com.example.remind.feature.splash.SplashEvent.NavigateLogin INSTANCE = null;
        
        private NavigateLogin() {
        }
    }
}