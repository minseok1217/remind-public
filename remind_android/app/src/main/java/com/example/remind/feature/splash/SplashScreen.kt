package com.example.remind.feature.splash

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.example.remind.core.ui.component.DoubleBackToExit
import com.example.remind.core.ui.theme.RemindTheme
import com.example.remind.navigation.Routes

@Composable
fun SplashScreen(
    navController: NavHostController,
    viewModel: SplashViewModel = hiltViewModel()
) {
    LaunchedEffect(Unit) {
        viewModel.event.collect { event ->
            when (event) {
                SplashEvent.NavigateHome -> navController.navigate(Routes.HOME) {
                    popUpTo(Routes.SPLASH) { inclusive = true }
                }
                SplashEvent.NavigateLogin -> navController.navigate(Routes.LOGIN) {
                    popUpTo(Routes.SPLASH) { inclusive = true }
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.checkAutoLogin()
    }

    DoubleBackToExit()

    SplashContent()
}

@Composable
fun SplashContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text("REMIND")
    }
}

@Preview(showBackground = true)
@Composable
fun SplashScreenPreview() {
    RemindTheme {
        SplashContent()
    }
}
