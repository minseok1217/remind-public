package com.example.remind.feature.home

data class HomeState(
    val userName: String = "",
    val todayCallStatus: String = "",
    val totalScore: Int = 0,
    val languageScore: Float = 0f,
    val memoryScore: Float = 0f,
    val emotionalScore: Float = 0f,
    val isLoading: Boolean = false
)