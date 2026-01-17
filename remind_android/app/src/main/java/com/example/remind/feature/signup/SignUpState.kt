package com.example.remind.feature.signup

data class SignUpState(
    val parentName: String = "",
    val parentPhone: String = "",
    val parentId: String = "",
    val parentPw: String = "",
    val patientName: String = "",
    val patientBirth: String = "",
    val patientId: String = "",
    val patientPw: String = "",
    val patientPhone: String = "",
    val isAgreed: Boolean = false,
    val isLoading: Boolean = false
)