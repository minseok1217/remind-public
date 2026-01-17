package com.example.remind.feature.login

sealed class LoginEvent {
    object LoginSuccess : LoginEvent()
    object LoginFail : LoginEvent()
}

