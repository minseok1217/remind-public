package com.example.remind.core.ui.component

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext

@Composable
fun DoubleBackToExit(
    exitMessage: String = "뒤로가기를 한 번 더 누르면 종료됩니다."
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var backPressedTime by remember { mutableStateOf(0L) }
    val scope = rememberCoroutineScope()

    BackHandler {
        val currentTime = System.currentTimeMillis()
        if (currentTime - backPressedTime < 2000) {
            activity?.finish() // 앱 종료
        } else {
            backPressedTime = currentTime
            Toast.makeText(context, exitMessage, Toast.LENGTH_SHORT).show()
        }
    }
}
