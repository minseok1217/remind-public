package com.example.remind.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.example.remind.core.ui.theme.RemindTheme

// 시안 기반 테마 컬러 정의
val MainGreen = Color(0xFF76BA81)
val LightGreen = Color(0xFFE2F1E5)
val ProgressBarColor = Color(0xFF42FF8E)

@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = hiltViewModel(),
    navController: NavHostController
) {
    // ViewModel에서 DB 상태를 수집
    val state by viewModel.state.collectAsState<HomeState>()

    Scaffold(
        bottomBar = { HomeBottomNavigation() }
    ) { innerPadding ->
        if (state.isLoading) {
            // 로딩 중일 때 표시
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MainGreen)
            }
        } else {
            // 실제 UI 내용 호출
            HomeContent(
                state = state,
                modifier = modifier.padding(innerPadding)
            )
        }
    }
}

@Composable
fun HomeContent(
    state: HomeState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        // 1. 상단 헤더 (보호자 성함)
        HomeHeader(userName = state.userName)

        Spacer(modifier = Modifier.height(24.dp))

        // 2. 오늘의 현황 카드
        Text("오늘의 현황", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(12.dp))
        TodayStatusCard(statusMessage = state.todayCallStatus)

        Spacer(modifier = Modifier.height(24.dp))

        // 3. 인지 상태 요약 (점수 그래프)
        Text("인지 상태 요약", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("최근 일주일간 통화를 분석했습니다.", fontSize = 14.sp, color = Color.Gray)
        Spacer(modifier = Modifier.height(12.dp))
        CognitiveStatusCard(state = state)

        Spacer(modifier = Modifier.height(24.dp))

        // 4. 최근 통화 기록 (리스트)
        Text("최근 통화 기록", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(12.dp))
        repeat(3) {
            CallRecordItem()
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

@Composable
fun HomeHeader(userName: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // 프로필 이미지 자립
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color(0xFFF0F0F0), RoundedCornerShape(24.dp))
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text("보호자", fontSize = 12.sp, color = MainGreen)
                Text("안녕하세요, ${userName}님!", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
        Icon(Icons.Default.Notifications, contentDescription = null, tint = MainGreen)
    }
}

@Composable
fun TodayStatusCard(statusMessage: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MainGreen),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text("오늘 통화 완료", color = Color.White, fontWeight = FontWeight.Bold)
            Text(statusMessage, color = Color.White, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text("통화 시간", color = Color.White, fontSize = 12.sp)
                    Text("오후 2:30 15분", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { /* 상세 페이지 이동 */ },
                    colors = ButtonDefaults.buttonColors(containerColor = LightGreen),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text("분석 상세 →", color = Color.Black, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun CognitiveStatusCard(state: HomeState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MainGreen),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("전반적인 상태", color = Color.White, fontSize = 12.sp)
                Text("매우 양호", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(12.dp))
                // DB 연동 게이지 바
                StatusProgressBar("언어", state.languageScore)
                StatusProgressBar("기억", state.memoryScore)
                StatusProgressBar("정서", state.emotionalScore)
            }
            // 전체 점수 표시
            Text("${state.totalScore}점", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun StatusProgressBar(label: String, progress: Float) {
    Row(
        modifier = Modifier.padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color.White, fontSize = 12.sp, modifier = Modifier.width(35.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .height(8.dp)
                .weight(1f)
                .padding(horizontal = 8.dp),
            color = ProgressBarColor,
            trackColor = Color.White.copy(alpha = 0.3f),
            strokeCap = androidx.compose.ui.graphics.StrokeCap.Round
        )
        Text("${(progress * 100).toInt()}점", color = Color.White, fontSize = 10.sp)
    }
}

@Composable
fun CallRecordItem() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .background(LightGreen, RoundedCornerShape(12.dp))
    )
}

@Composable
fun HomeBottomNavigation() {
    NavigationBar(containerColor = Color.White) {
        NavigationBarItem(selected = true, onClick = {}, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("홈") })
        NavigationBarItem(selected = false, onClick = {}, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("통계") })
        NavigationBarItem(selected = false, onClick = {}, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("사진 추가") })
        NavigationBarItem(selected = false, onClick = {}, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("내 정보") })
    }
}

// --- Preview ---

@Preview(showBackground = true, name = "홈 화면 시안 미리보기")
@Composable
fun HomePreview() {
    RemindTheme {
        val mockState = HomeState(
            userName = "김철수",
            todayCallStatus = "오늘 통화를 완료했어요!\n목소리가 평소보다 밝게 들렸어요!",
            totalScore = 75,
            languageScore = 0.75f,
            memoryScore = 0.7f,
            emotionalScore = 0.8f,
            isLoading = false
        )
        HomeContent(state = mockState)
    }
}