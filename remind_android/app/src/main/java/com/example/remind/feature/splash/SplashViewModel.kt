package com.example.remind.feature.splash

import androidx.lifecycle.ViewModel
import com.example.remind.domain.usecase.CheckAutoLoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val checkAutoLoginUseCase: CheckAutoLoginUseCase
) : ViewModel() {

    private val _event = MutableSharedFlow<SplashEvent>()
    val event = _event.asSharedFlow()

    suspend fun checkAutoLogin() {
        val loggedIn = checkAutoLoginUseCase()
        if (loggedIn) _event.emit(SplashEvent.NavigateHome)
        else _event.emit(SplashEvent.NavigateLogin)
    }
}
