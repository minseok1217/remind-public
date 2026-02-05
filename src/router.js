import LoginView, { attachLoginEvents } from './views/LoginView.js';
import SignupView, { attachSignupEvents } from './views/SignupView.js'; 
import FindAccountView, { attachFindEvents } from './views/FindAccountView.js';
import ChatView, { attachChatEvents } from './views/ChatView.js';

// import HomeView, { attachHomeEvents } from './views/HomeView.js';
// import PhotoUploadView, { attachPhotoEvents } from './views/PhotoUploadView.js';
// import StatsView, { attachStatsEvents } from './views/StatsView.js';
// import ProfileView, { attachProfileEvents } from './views/ProfileView.js';
import NavigationBar from './components/NavigationBar.js';

const routes = {
    '/': { view: LoginView, init: attachLoginEvents },
    '/index.html': { view: LoginView, init: attachLoginEvents },
    '/signup': { view: SignupView, init: attachSignupEvents },
    '/find-id': { view: FindAccountView, init: attachFindEvents },
    '/find-pw': { view: FindAccountView, init: attachFindEvents },
    '/chat': { view: ChatView, init: attachChatEvents },
    // '/home': { view: HomeView, init: attachHomeEvents },
    // '/photo-upload': { view: PhotoUploadView, init: attachPhotoEvents },
    // '/stats': { view: StatsView, init: attachStatsEvents },
    // '/profile': { view: ProfileView, init: attachProfileEvents }
};
// router.js (또는 index.js)

export const handleRoute = async () => {
    const path = window.location.pathname;
    // index.html로 끝나는 경로 처리
    const routePath = path.endsWith('index.html') ? '/' : path;
    
    // routes에서 설정값 가져오기 (이전 답변에서 정의한 routes 객체 사용)
    const route = routes[routePath] || routes['/'];
    
    const appContainer = document.querySelector('#app');
    
    // 1. 하단 네비게이션 바를 숨겨야 하는 경로 정의
    const hideNavPaths = ['/', '/signup', '/find-id', '/find-pw'];
    const shouldShowNav = !hideNavPaths.includes(routePath);

    // 2. 화면 렌더링
    if (shouldShowNav) {
        // 네비게이션 바가 포함된 구조로 렌더링
        // route.view()가 함수 형태이므로 실행해서 결과값을 넣습니다.
        appContainer.innerHTML = `
            <div class="content-wrapper" style="padding-bottom: 75px; height: 100%;">
                ${route.view()}
            </div>
            ${NavigationBar()}
        `;
    } else {
        // 로그인/회원가입 등 네비게이션 바 없는 화면
        appContainer.innerHTML = route.view();
    }
    
    // 3. 네비게이션 바 이벤트 바인딩 (SPA 이동을 위해)
    // 네비바가 렌더링된 후에 클릭 이벤트를 가로채야 합니다.
    if (shouldShowNav) {
        const navLinks = appContainer.querySelectorAll('nav a, .nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href') || link.dataset.path;
                if (href) navigateTo(href);
            });
        });
    }

    // 4. 이벤트 연결 (중요: 렌더링이 완료된 후 각 View의 이벤트를 바인딩)
    // ChatView의 경우 attachChatEvents()가 여기서 실행됩니다.
    if (route.init) {
        route.init();
    }
    
    // 페이지 이동 시 항상 스크롤 상단 이동
    window.scrollTo(0, 0);
};

// 페이지 이동 함수
export const navigateTo = (url) => {
    history.pushState(null, null, url);
    handleRoute();
};

// 브라우저 뒤로가기 대응
window.onpopstate = handleRoute;

// 뒤로가기/앞으로가기 버튼 대응
window.addEventListener('popstate', handleRoute);