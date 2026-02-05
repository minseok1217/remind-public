export default function StatsView() {
    return `
        <div class="page-container">
            <h2 class="header-title text-center">통계 요약</h2>
            <div class="tab-container mt-20">
                <button class="tab active">최근 7일</button>
                <button class="tab">최근 30일</button>
            </div>
            <div class="card mt-20">
                <p class="status-label">인지 상태 변화</p>
                <div class="flex-between">
                    <h3 class="score-large">75점</h3>
                    <span class="date-range">01월 01일 - 01월 07일</span>
                </div>
                <div class="chart-placeholder">[그래프 영역]</div>
            </div>
            <div class="tip-box mt-20">
                🔍 안정적 상태입니다. 지난 주 대비 기억력 관련 단어 사용이 증가했습니다.
            </div>
        </div>
    `;
}