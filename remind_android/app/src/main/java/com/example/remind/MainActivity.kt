package com.example.remind

import android.app.AlarmManager
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.remind.core.ui.theme.RemindTheme // 팀원이 만든 테마
import com.example.remind.navigation.NavGraph
import com.google.firebase.firestore.FirebaseFirestore // 사용자님이 추가한 DB
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ==========================================
        // [수정된 DB 연결 테스트 코드] - 날짜 시간 추가!
        // ==========================================
        val db = FirebaseFirestore.getInstance()

        // 1. 현재 시간을 "년-월-일 시:분:초"로 만들기
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.KOREA)
        val currentTime = sdf.format(java.util.Date())

        val testUser = hashMapOf(
            "name" to "최정욱",
            "role" to "Back-End",
            "message" to "시간도 잘 찍히나요?",
            "created_at" to currentTime // 👉 여기에 '몇시 몇분'이 저장됩니다!
        )

        db.collection("test_connection")
            .add(testUser)
            .addOnSuccessListener { documentReference ->
                Log.d("FIREBASE_TEST", "성공! 시간: $currentTime")
            }
            .addOnFailureListener { e ->
                Log.w("FIREBASE_TEST", "실패했습니다...", e)
            }
        // ==========================================

        setContent {
            RemindTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    NavGraph()
                }
            }
        }

        // ==========================================
        // [3. 알람 권한 체크 (사용자님 코드 유지)]
        // ==========================================
        // 팀원은 주석 처리해놨지만, 알람 앱이라면 권한 체크가 필요하므로 살려둡니다.
        val alarmManager = getSystemService(AlarmManager::class.java)
        if (!alarmManager.canScheduleExactAlarms()) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            startActivity(intent)
        }
    }
}