package com.example.remind.feature.call

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.remind.core.ui.theme.RemindTheme

@Composable
fun AlarmScreen(
    onStop: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("⏰ 알람 울림!", fontSize = 32.sp)
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onStop) {
                Text("알람 끄기")
            }
        }
    }
}

// --- Preview 영역 ---

@Preview(showBackground = true, name = "알람 울림 화면 미리보기")
@Composable
fun AlarmScreenPreview() {
    RemindTheme {
        // 실제 동작 대신 빈 중괄호 {}를 전달하여 UI만 확인합니다.
        AlarmScreen(
            onStop = {}
        )
    }
}