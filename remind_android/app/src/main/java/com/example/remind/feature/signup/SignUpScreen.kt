package com.example.remind.feature.signup

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.remind.core.ui.component.RemindTextField
import com.example.remind.core.ui.theme.RemindBorderGray
import com.example.remind.core.ui.theme.RemindGreen
import com.example.remind.core.ui.theme.RemindTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    navController: NavController,
    viewModel: SignUpViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState
    val guardianName by viewModel.guardianName
    val guardianPhone by viewModel.guardianPhone
    val email by viewModel.email
    val password by viewModel.password
    val isPasswordVisible by viewModel.isPasswordVisible
    val patientName by viewModel.patientName
    val patientDob by viewModel.patientDob
    val patientIdText by viewModel.patientIdText
    val patientPasswordText by viewModel.patientPasswordText
    val patientPhone by viewModel.patientPhone
    val isAgreed by viewModel.isAgreed

    SignUpContent(
        uiState = uiState,
        guardianName = guardianName,
        guardianPhone = guardianPhone,
        email = email,
        password = password,
        isPasswordVisible = isPasswordVisible,
        patientName = patientName,
        patientDob = patientDob,
        patientIdText = patientIdText,
        patientPasswordText = patientPasswordText,
        patientPhone = patientPhone,
        isAgreed = isAgreed,
        onGuardianNameChange = viewModel::onGuardianNameChange,
        onGuardianPhoneChange = viewModel::onGuardianPhoneChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        togglePasswordVisibility = viewModel::togglePasswordVisibility,
        onPatientNameChange = viewModel::onPatientNameChange,
        onPatientDobChange = viewModel::onPatientDobChange,
        onPatientIdTextChange = viewModel::onPatientIdTextChange,
        onPatientPasswordTextChange = viewModel::onPatientPasswordTextChange,
        onPatientPhoneChange = viewModel::onPatientPhoneChange,
        onAgreementChange = viewModel::onAgreementChange,
        onSignUpClick = { viewModel.signUp { navController.popBackStack() } },
        onBackClick = { navController.popBackStack() }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpContent(
    uiState: String,
    guardianName: String,
    guardianPhone: String,
    email: String,
    password: String,
    isPasswordVisible: Boolean,
    patientName: String,
    patientDob: String,
    patientIdText: String,
    patientPasswordText: String,
    patientPhone: String,
    isAgreed: Boolean,
    onGuardianNameChange: (String) -> Unit,
    onGuardianPhoneChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    togglePasswordVisibility: () -> Unit,
    onPatientNameChange: (String) -> Unit,
    onPatientDobChange: (String) -> Unit,
    onPatientIdTextChange: (String) -> Unit,
    onPatientPasswordTextChange: (String) -> Unit,
    onPatientPhoneChange: (String) -> Unit,
    onAgreementChange: (Boolean) -> Unit,
    onSignUpClick: () -> Unit,
    onBackClick: () -> Unit
) {
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("회원가입", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "뒤로가기")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp)
                .verticalScroll(scrollState)
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            // === 1. 보호자 섹션 ===
            SectionTitle(text = "보호자")
            Spacer(modifier = Modifier.height(16.dp))

            RemindTextField(
                value = guardianName,
                onValueChange = onGuardianNameChange,
                placeholderText = "이름"
            )
            Spacer(modifier = Modifier.height(12.dp))
            RemindTextField(
                value = guardianPhone,
                onValueChange = onGuardianPhoneChange,
                placeholderText = "전화번호",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
            )
            Spacer(modifier = Modifier.height(12.dp))

            // 아이디
            RemindTextField(
                value = email,
                onValueChange = onEmailChange,
                placeholderText = "아이디 (이메일)",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )
            Spacer(modifier = Modifier.height(12.dp))

            // 비밀번호
            RemindTextField(
                value = password,
                onValueChange = onPasswordChange,
                placeholderText = "비밀번호 (6자리 이상)",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    val image = if (isPasswordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff
                    IconButton(onClick = togglePasswordVisibility) {
                        Icon(imageVector = image, contentDescription = "비밀번호 보이기/숨기기", tint = RemindGreen)
                    }
                }
            )

            Spacer(modifier = Modifier.height(32.dp))

            // === 2. 환자 섹션 ===
            SectionTitle(text = "환자")
            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, RemindBorderGray),
                color = Color.Transparent
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    RemindTextField(
                        value = patientName,
                        onValueChange = onPatientNameChange,
                        placeholderText = "이름"
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    RemindTextField(
                        value = patientDob,
                        onValueChange = onPatientDobChange,
                        placeholderText = "생년월일 (예: 19500101)",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    RemindTextField(
                        value = patientIdText,
                        onValueChange = onPatientIdTextChange,
                        placeholderText = "아이디 (단순 기록용)"
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    RemindTextField(
                        value = patientPasswordText,
                        onValueChange = onPatientPasswordTextChange,
                        placeholderText = "비밀번호 (단순 기록용)"
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    RemindTextField(
                        value = patientPhone, 
                        onValueChange = onPatientPhoneChange,
                        placeholderText = "전화번호",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // === 3. 하단 ===
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = isAgreed,
                    onCheckedChange = onAgreementChange,
                    colors = CheckboxDefaults.colors(checkedColor = RemindGreen)
                )
                Text(text = "약관 동의", style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.isNotEmpty() && !uiState.contains("성공")) {
                Text(text = uiState, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))
            }

            Button(
                onClick = onSignUpClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RemindGreen),
                shape = RoundedCornerShape(12.dp),
                enabled = isAgreed
            ) {
                Text(text = "가입하기", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}


@Composable
fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        color = Color.Black
    )
}

@Preview(showBackground = true)
@Composable
fun SignUpScreenPreview() {
    RemindTheme {
        var isAgreed by remember { mutableStateOf(true) }
        SignUpContent(
            uiState = "",
            guardianName = "홍길동",
            guardianPhone = "010-1234-5678",
            email = "test@test.com",
            password = "password",
            isPasswordVisible = false,
            patientName = "김환자",
            patientDob = "19500101",
            patientIdText = "patient_id",
            patientPasswordText = "patient_pw",
            patientPhone = "010-9876-5432",
            isAgreed = isAgreed,
            onGuardianNameChange = {},
            onGuardianPhoneChange = {},
            onEmailChange = {},
            onPasswordChange = {},
            togglePasswordVisibility = {},
            onPatientNameChange = {},
            onPatientDobChange = {},
            onPatientIdTextChange = {},
            onPatientPasswordTextChange = {},
            onPatientPhoneChange = {},
            onAgreementChange = { isAgreed = it },
            onSignUpClick = {},
            onBackClick = {}
        )
    }
}
