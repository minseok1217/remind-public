package com.example.remind.feature.splash

sealed class SplashEvent {
    object NavigateHome : SplashEvent()
    object NavigateLogin : SplashEvent()
}
