package com.example.remind.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.remind.feature.login.LoginScreen
import com.example.remind.feature.signup.SignUpScreen
// import com.example.remind.feature.home.HomeScreen // 홈 화면이 있다면 주석 해제

@Composable
fun NavGraph() {
    val navController = rememberNavController()

    // startDestination = "login" -> 앱 켜자마자 로그인 화면부터 시작!
    NavHost(navController = navController, startDestination = "login") {

        // 1. 로그인 화면
        composable("login") {
            LoginScreen(navController = navController)
        }

        // 2. 회원가입 화면
        composable("signup") {
            SignUpScreen(navController = navController)
        }

        // 3. 홈 화면 (로그인 성공하면 여기로!)
        composable("home") {
            // 아직 홈 화면이 없다면 임시로 텍스트만 띄움
            androidx.compose.material3.Text("로그인 성공! 홈 화면입니다.")

            // 만약 팀원이 만든 HomeScreen이 있다면 위 줄 지우고 아래 주석 해제
            // HomeScreen(navController = navController)
        }
    }
}