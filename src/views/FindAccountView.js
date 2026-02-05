import { auth, db } from '../api/firebase.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { navigateTo } from '../router.js';

export default function FindAccountView() {
    const isPwPage = window.location.pathname === '/find-pw';
    
    return `
        <div class="find-page-container">
            <header class="signup-header">
                <button class="back-btn" id="go-login-btn">〈</button>
                <h2 class="header-title">계정 정보 찾기</h2>
            </header>

            <div class="tab-menu">
                <div class="tab-item ${!isPwPage ? 'active' : ''}" id="tab-id">아이디 찾기</div>
                <div class="tab-item ${isPwPage ? 'active' : ''}" id="tab-pw">비밀번호 찾기</div>
            </div>

            <div class="find-content">
                <div id="find-form-area">
                    <h3 class="find-title" id="find-title">
                        ${isPwPage ? '비밀번호를 잊으셨나요?' : '아이디를 잊으셨나요?'}
                    </h3>
                    <p class="find-desc">가입 시 등록한 정보를 입력해주세요.</p>

                    <div class="input-group" id="id-input-group" style="display: ${isPwPage ? 'block' : 'none'};">
                        <label>아이디</label>
                        <input type="email" id="input-email" placeholder="아이디(이메일)를 입력하세요" class="common-input">
                    </div>

                    <div class="input-group">
                        <label>이름</label>
                        <input type="text" id="input-name" placeholder="성함을 입력하세요" class="common-input">
                    </div>

                    <div class="input-group">
                        <label>휴대폰 번호</label>
                        <div class="phone-input-row">
                            <input type="tel" id="phone-input" placeholder="01012345678" class="common-input">
                            <button type="button" class="verify-req-btn" id="start-timer-btn">인증 요청</button>
                        </div>
                    </div>

                    <div class="verify-box">
                        <p class="verify-msg">인증번호 4자리를 입력해주세요</p>
                        <div class="code-input-container">
                            <input type="number" id="hidden-code-input" pattern="\\d*" inputmode="numeric" maxlength="4">
                            <div class="code-slots">
                                <div class="slot" id="slot-0"></div>
                                <div class="slot" id="slot-1"></div>
                                <div class="slot" id="slot-2"></div>
                                <div class="slot" id="slot-3"></div>
                            </div>
                        </div>
                        <div class="verify-timer">
                            <span class="time" id="timer-display">03:00</span>
                            <button type="button" class="resend-btn">인증번호 재전송</button>
                        </div>
                    </div>

                    <div id="recaptcha-container"></div>

                    <button type="button" class="main-btn find-submit-btn" id="final-submit-btn">
                        ${isPwPage ? '비밀번호 찾기' : '아이디 찾기'}
                    </button>
                </div>

                <div id="find-result-area" style="display: none; text-align: center; padding: 40px 0;">
                    <div class="result-icon" style="font-size: 50px; margin-bottom: 20px;">✅</div>
                    <h3 id="result-message" style="margin-bottom: 10px;">아이디 찾기 성공</h3>
                    <p id="result-detail" style="color: #666; margin-bottom: 30px; font-weight: bold; font-size: 18px; color: #00c73c;"></p>
                    <button type="button" class="main-btn" id="go-to-login-final">로그인 화면으로</button>
                </div>
            </div>
        </div>
    `;
}

let timerInterval = null;

export function attachFindEvents() {
    const backBtn = document.getElementById('go-login-btn');
    const tabId = document.getElementById('tab-id');
    const tabPw = document.getElementById('tab-pw');
    const idGroup = document.getElementById('id-input-group');
    const findTitle = document.getElementById('find-title');
    const submitBtn = document.getElementById('final-submit-btn');
    const hiddenInput = document.getElementById('hidden-code-input');
    const slots = [0, 1, 2, 3].map(i => document.getElementById(`slot-${i}`));

    // 1. 뒤로가기
    backBtn?.addEventListener('click', () => navigateTo('/'));
    document.getElementById('go-to-login-final')?.addEventListener('click', () => navigateTo('/'));

    // 2. 탭 전환
    const updateTab = (isPw) => {
        idGroup.style.display = isPw ? 'block' : 'none';
        findTitle.innerText = isPw ? "비밀번호를 잊으셨나요?" : "아이디를 잊으셨나요?";
        submitBtn.innerText = isPw ? "비밀번호 찾기" : "아이디 찾기";
        tabId.classList.toggle('active', !isPw);
        tabPw.classList.toggle('active', isPw);
        window.history.pushState({}, "", isPw ? '/find-pw' : '/find-id');
    };
    tabId?.addEventListener('click', () => updateTab(false));
    tabPw?.addEventListener('click', () => updateTab(true));

    // 3. reCAPTCHA 초기화
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
    }

    // 4. 인증 요청 (signInWithPhoneNumber)
    document.getElementById('start-timer-btn')?.addEventListener('click', async () => {
        let phone = document.getElementById('phone-input').value;
        if(!phone.startsWith('+82')) phone = '+82' + phone.replace(/^0/, ''); // +8210... 형식으로 변환

        try {
            window.confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
            startTimer();
            alert("인증번호가 발송되었습니다.");
        } catch (error) {
            console.error(error);
            alert("인증 요청 실패. 번호를 확인해 주세요.");
        }
    });

    // 5. 타이머 함수
    function startTimer() {
        let time = 180;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const min = Math.floor(time / 60);
            const sec = time % 60;
            document.getElementById('timer-display').innerText = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            if (--time < 0) clearInterval(timerInterval);
        }, 1000);
    }

    // 6. 결과 확인 및 제출
    submitBtn?.addEventListener('click', async () => {
        const code = hiddenInput.value;
        if (!window.confirmationResult) return alert("인증 요청을 먼저 해주세요.");

        try {
            const result = await window.confirmationResult.confirm(code);
            const user = result.user;

            // Firestore에서 사용자 정보 찾기 (예시)
            const q = query(collection(db, "users"), where("parentPhone", "==", document.getElementById('phone-input').value));
            const querySnapshot = await getDocs(q);
            
            let emailFound = user.email || "정보를 불러올 수 없음";
            querySnapshot.forEach((doc) => { emailFound = doc.data().email; });

            // UI 전환
            document.getElementById('find-form-area').style.display = 'none';
            document.getElementById('find-result-area').style.display = 'block';
            document.getElementById('result-detail').innerText = `찾으신 계정: ${emailFound}`;

        } catch (error) {
            alert("인증번호가 일치하지 않습니다.");
        }
    });

    // 7. 슬롯 애니메이션
    hiddenInput?.addEventListener('input', (e) => {
        const val = e.target.value.slice(0, 4);
        e.target.value = val;
        slots.forEach((slot, i) => {
            slot.innerText = val[i] || "";
            slot.classList.toggle('filled', !!val[i]);
            slot.classList.toggle('active', i === val.length);
        });
    });
}