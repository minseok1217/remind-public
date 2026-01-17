package com.example.remind.feature.login

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val auth: FirebaseAuth
) : ViewModel() {

    // [중요] 화면에서 갖다 쓸 변수들 (이게 없어서 에러가 났던 겁니다!)
    private val _email = mutableStateOf("")
    val email: State<String> = _email

    private val _password = mutableStateOf("")
    val password: State<String> = _password

    private val _loginState = mutableStateOf("")
    val loginState: State<String> = _loginState

    fun onEmailChange(newEmail: String) {
        _email.value = newEmail
    }

    fun onPasswordChange(newPassword: String) {
        _password.value = newPassword
    }

    // [중요] 로그인 기능 함수
    fun login(onSuccess: () -> Unit) {
        if (_email.value.isEmpty() || _password.value.isEmpty()) {
            _loginState.value = "이메일과 비밀번호를 입력해주세요."
            return
        }

        viewModelScope.launch {
            auth.signInWithEmailAndPassword(_email.value, _password.value)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        _loginState.value = "로그인 성공!"
                        onSuccess()
                    } else {
                        _loginState.value = "로그인 실패: ${task.exception?.message}"
                    }
                }
        }
    }
}