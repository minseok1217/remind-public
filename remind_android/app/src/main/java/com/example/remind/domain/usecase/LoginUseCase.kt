package com.example.remind.domain.usecase

import javax.inject.Inject
class LoginUseCase @Inject constructor() {

    operator fun invoke(id: String, password: String): Boolean {
        // 임시 로그인 규칙
        return id == "test" && password == "1234"
    }
}
