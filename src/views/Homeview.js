// 점수 바를 그려주는 헬퍼 함수
function renderScoreBar(label, score) {
    return `
        <div class="score-item">
            <div class="flex-between">
                <span class="label">${label}</span>
                <span class="score">${score}점</span>
            </div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${score}%;"></div>
            </div>
        </div>
    `;
}

export default function HomeView() {
    return `
        <div class="page-container bg-light">
            <header class="home-header">
                <p class="user-role">보호자</p>
                <div class="flex-between">
                    <h2 class="welcome-text">안녕하세요, 김철수님!</h2>
                    <span class="bell-icon">🔔</span>
                </div>
            </header>
            
            <section class="card status-card mt-20">
                <h3>오늘 통화 완료</h3>
                <p>목소리가 평소보다 밝게 들렸어요!</p>
                <div class="time-info">통화 시간: 오후 2:30 15분</div>
                <button class="white-btn" id="record-check-btn">기록 확인</button>
            </section>

            <section class="mt-30">
                <h3 class="section-title">최근 인지 상태 요약</h3>
                <div class="card cognitive-card">
                    <div class="flex-between">
                        <div>
                            <p class="status-label">전반적인 상태</p>
                            <h4 class="status-value">매우 양호</h4>
                        </div>
                        <div class="score-main">75점</div>
                    </div>
                    <div class="score-bar-group">
                        ${renderScoreBar('언어', 75)}
                        ${renderScoreBar('기억', 70)}
                        ${renderScoreBar('정서', 80)}
                    </div>
                </div>
            </section>
        </div>
    `;
}

export function attachHomeEvents() {
    const recordBtn = document.getElementById('record-check-btn');
    if (recordBtn) {
        recordBtn.onclick = () => {
            console.log("기록 확인 버튼이 클릭되었습니다.");
            // 기록 확인 페이지로 이동하거나 팝업을 띄우는 로직을 여기에 추가하세요.
        };
    }
}