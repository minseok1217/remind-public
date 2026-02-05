import { handleRoute, navigateTo } from './router.js';

window.addEventListener('popstate', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
    // 'data-link' 속성이 있는 링크 클릭 시 페이지 새로고침 방지
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('[data-link]')) {
            e.preventDefault();
            navigateTo(e.target.href);
        }
    });

    handleRoute(); // 첫 화면 로드
});