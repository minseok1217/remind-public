package com.example.remind.domain.usecase

import javax.inject.Inject

class CheckAutoLoginUseCase @Inject constructor() {

    suspend operator fun invoke(): Boolean {
        // 임시 체크
        return false
    }
}
