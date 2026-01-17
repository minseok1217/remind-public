package com.example.remind.feature.login

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.remind.core.ui.component.RemindTextField
import com.example.remind.core.ui.theme.RemindGreen
import com.example.remind.core.ui.theme.RemindTextGray
import com.example.remind.core.ui.theme.RemindTheme

@Composable
fun LoginScreen(
    navController: NavController,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val email by viewModel.email
    val password by viewModel.password
    val loginState by viewModel.loginState

    LoginScreenContent(
        email = email,
        password = password,
        loginState = loginState,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onLoginClick = {
            viewModel.login {
                navController.navigate("home") {
                    popUpTo("login") { inclusive = true }
                }
            }
        },
        onFindIdClick = { /* TODO */ },
        onFindPasswordClick = { /* TODO */ },
        onSignUpClick = { navController.navigate("signup") }
    )
}

@Composable
fun LoginScreenContent(
    email: String,
    password: String,
    loginState: String,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLoginClick: () -> Unit,
    onFindIdClick: () -> Unit,
    onFindPasswordClick: () -> Unit,
    onSignUpClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .systemBarsPadding(), // 상단 상태바 영역 침범 방지
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.weight(1f)) // 상단 여백을 유동적으로

        // 타이틀
        Text(
            text = "로그인",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )

        Spacer(modifier = Modifier.height(48.dp))

        // 아이디(이메일) 입력창
        RemindTextField(
            value = email,
            onValueChange = onEmailChange,
            placeholderText = "아이디",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )

        Spacer(modifier = Modifier.height(16.dp))

        // 비밀번호 입력창
        RemindTextField(
            value = password,
            onValueChange = onPasswordChange,
            placeholderText = "비밀번호",
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // 로그인 버튼
        Button(
            onClick = onLoginClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RemindGreen),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
        ) {
            Text(text = "로그인", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // 하단 링크 (아이디 찾기 | 비밀번호 찾기 | 회원가입)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BottomLinkText(text = "아이디 찾기", onClick = onFindIdClick)
            DividerText()
            BottomLinkText(text = "비밀번호 찾기", onClick = onFindPasswordClick)
            DividerText()
            BottomLinkText(text = "회원가입", onClick = onSignUpClick)
        }

        Spacer(modifier = Modifier.weight(1f)) // 하단 여백

        // 에러 메시지 표시
        if (loginState.isNotEmpty() && !loginState.contains("성공")) {
            Text(
                text = loginState,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
    }
}


@Composable
fun BottomLinkText(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 8.dp)) {
        Text(text = text, color = RemindTextGray, fontSize = 14.sp)
    }
}

@Composable
fun DividerText() {
    Text(
        text = "|",
        color = RemindTextGray,
        fontSize = 14.sp,
        modifier = Modifier.padding(horizontal = 4.dp)
    )
}

@Preview(showBackground = true)
@Composable
fun LoginScreenPreview() {
    RemindTheme {
        LoginScreenContent(
            email = "test@test.com",
            password = "password",
            loginState = "",
            onEmailChange = {},
            onPasswordChange = {},
            onLoginClick = {},
            onFindIdClick = {},
            onFindPasswordClick = {},
            onSignUpClick = {}
        )
    }
}
