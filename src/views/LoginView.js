// import { auth } from '../api/firebase.js';
// import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// import { navigateTo } from '../router.js';

// export default function LoginView() {
//     return `
//         <div class="login-wrapper">
//             <div class="logo-area">
//                 <img src="assets/logo_section.png" alt="Logo" class="top-logo-img">
//                 <p class="slogan">기억을 잇다, 마음을 잇다</p>
//             </div>
            
//             <form class="login-form" id="login-form">
//                 <div class="input-container">
//                     <label>이메일 아이디</label>
//                     <input type="email" id="email" placeholder="이메일을 입력하세요" required>
//                 </div>
//                 <div class="input-container">
//                     <label>비밀번호</label>
//                     <input type="password" id="password" placeholder="비밀번호를 입력하세요" required>
//                 </div>
//                 <button type="submit" class="login-submit-btn">로그인</button>
//             </form>

//             <div class="footer-nav">
//                 <a href="/find-id" data-link>아이디 찾기</a>
//                 <span class="bar">|</span>
//                 <a href="/find-pw" data-link>비밀번호 찾기</a>
//                 <span class="bar">|</span>
//                 <a href="/signup" data-link>회원가입</a>
//             </div>
//         </div>
//     `;
// }

// export function attachLoginEvents() {
//     const loginForm = document.querySelector('#login-form');
//     if (!loginForm) return;

//     loginForm.addEventListener('submit', async (e) => {
//         e.preventDefault();
//         const email = e.target.email.value;
//         const password = e.target.password.value;

//         try {
//             const userCredential = await signInWithEmailAndPassword(auth, email, password);
//             navigateTo('/home'); 
//         } catch (error) {
//             alert("로그인 실패: " + error.message);
//         }
//     });
// }

import { auth } from '../api/firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { navigateTo } from '../router.js';

export default function LoginView() {
    return `
        <div class="login-wrapper">
            <div class="logo-area">
                <img src="assets/logo_section.png" alt="Logo" class="top-logo-img">
                <p class="slogan">기억을 잇다, 마음을 잇다</p>
            </div>
            
            <form class="login-form" id="login-form">
                <div class="input-container">
                    <label>이메일 아이디</label>
                    <input type="email" id="email" placeholder="이메일을 입력하세요" required>
                </div>
                <div class="input-container">
                    <label>비밀번호</label>
                    <input type="password" id="password" placeholder="비밀번호를 입력하세요" required>
                </div>
                <button type="submit" class="login-submit-btn">로그인</button>
            </form>

            <div class="footer-nav">
                <a href="/find-id" class="nav-link">아이디 찾기</a>
                <span class="bar">|</span>
                <a href="/find-pw" class="nav-link">비밀번호 찾기</a>
                <span class="bar">|</span>
                <a href="/signup" class="nav-link">회원가입</a>
            </div>
        </div>
    `;
}

export function attachLoginEvents() {
    const loginForm = document.querySelector('#login-form');
    if (!loginForm) return;

    // 1. 로그인 폼 제출 이벤트
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("로그인 성공:", userCredential.user);
            
            // ✅ 이 부분을 /home에서 /chat으로 수정했습니다.
            navigateTo('/chat'); 
        } catch (error) {
            console.error("로그인 에러:", error.code);
            alert("로그인 실패: 이메일 또는 비밀번호를 확인해주세요.");
        }
    });

    // 2. 하단 링크(회원가입 등) 클릭 시 새로고침 방지 (옵션)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = e.target.getAttribute('href');
            navigateTo(path);
        });
    });
}