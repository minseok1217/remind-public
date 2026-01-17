package com.example.remind.feature.signup

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SignUpViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val db: FirebaseFirestore
) : ViewModel() {

    // === 보호자 정보 ===
    val guardianName = mutableStateOf("")
    val guardianPhone = mutableStateOf("")
    // *중요* 실제 로그인에 사용될 ID(이메일)와 비번
    val email = mutableStateOf("")
    val password = mutableStateOf("")
    val isPasswordVisible = mutableStateOf(false) // 비밀번호 보이기/숨기기 토글 상태

    // === 환자 정보 ===
    val patientName = mutableStateOf("")
    val patientDob = mutableStateOf("") // 생년월일
    val patientIdText = mutableStateOf("") // 단순 텍스트용 ID
    val patientPasswordText = mutableStateOf("") // 단순 텍스트용 PW
    val patientPhone = mutableStateOf("")

    // === 기타 ===
    val isAgreed = mutableStateOf(false) // 약관 동의
    val uiState = mutableStateOf("")

    // 입력값 변경 함수들
    fun onGuardianNameChange(v: String) { guardianName.value = v }
    fun onGuardianPhoneChange(v: String) { guardianPhone.value = v }
    fun onEmailChange(v: String) { email.value = v }
    fun onPasswordChange(v: String) { password.value = v }
    fun togglePasswordVisibility() { isPasswordVisible.value = !isPasswordVisible.value }

    fun onPatientNameChange(v: String) { patientName.value = v }
    fun onPatientDobChange(v: String) { patientDob.value = v }
    fun onPatientIdTextChange(v: String) { patientIdText.value = v }
    fun onPatientPasswordTextChange(v: String) { patientPasswordText.value = v }
    fun onPatientPhoneChange(v: String) { patientPhone.value = v }
    fun onAgreementChange(v: Boolean) { isAgreed.value = v }


    fun signUp(onSuccess: () -> Unit) {
        // 1. 필수 입력값 체크 (간단하게만)
        if (email.value.isEmpty() || password.value.isEmpty() || guardianName.value.isEmpty()) {
            uiState.value = "필수 정보를 모두 입력해주세요."
            return
        }
        if (!isAgreed.value) {
            uiState.value = "약관에 동의해주세요."
            return
        }

        uiState.value = "가입 진행 중..."
        viewModelScope.launch {
            // 2. 파이어베이스 인증(로그인 계정) 생성
            auth.createUserWithEmailAndPassword(email.value, password.value)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        // 3. 성공 시 Firestore에 나머지 정보 저장
                        saveUserInfoToFirestore(onSuccess)
                    } else {
                        uiState.value = "가입 실패: ${task.exception?.message}"
                    }
                }
        }
    }

    private fun saveUserInfoToFirestore(onSuccess: () -> Unit) {
        val uid = auth.currentUser?.uid ?: return

        // 저장할 데이터 뭉치 만들기
        val userMap = hashMapOf(
            "uid" to uid,
            "role" to "보호자(통합)", // 역할 고정
            "email" to email.value,
            "created_at" to System.currentTimeMillis(),

            // 보호자 상세 정보
            "guardian_info" to hashMapOf(
                "name" to guardianName.value,
                "phone" to guardianPhone.value
            ),

            // 환자 상세 정보
            "patient_info" to hashMapOf(
                "name" to patientName.value,
                "dob" to patientDob.value,
                "id_text" to patientIdText.value,
                "pw_text" to patientPasswordText.value,
                "phone" to patientPhone.value
            )
        )

        db.collection("users").document(uid)
            .set(userMap)
            .addOnSuccessListener {
                uiState.value = "회원가입 성공!"
                onSuccess()
            }
            .addOnFailureListener {
                uiState.value = "DB 저장 실패.. 관리자에게 문의하세요."
            }
    }
}