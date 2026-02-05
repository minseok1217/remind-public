export default function NavigationBar() {
    const path = window.location.pathname;
    
    // 현재 경로에 따라 활성화(active) 클래스 부여
    const isActive = (targetPath) => path === targetPath ? 'active' : '';

    return `
        <nav class="bottom-nav">
            <div class="nav-item ${isActive('/home')}" onclick="navigateTo('/home')">
                <div class="nav-icon">🏠</div>
                <span>홈</span>
            </div>
            <div class="nav-item ${isActive('/photo-upload')}" onclick="navigateTo('/photo-upload')">
                <div class="nav-icon">📷</div>
                <span>사진등록</span>
            </div>
            <div class="nav-item ${isActive('/stats')}" onclick="navigateTo('/stats')">
                <div class="nav-icon">📊</div>
                <span>통계</span>
            </div>
            <div class="nav-item ${isActive('/profile')}" onclick="navigateTo('/profile')">
                <div class="nav-icon">👤</div>
                <span>내 정보</span>
            </div>
        </nav>
    `;
}