import { auth, db } from '../api/firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { navigateTo } from '../router.js';

export default function SignupView() {
    return `
        <div class="signup-page-container">
            <header class="signup-header">
                <button class="back-btn" onclick="history.back()">〈</button>
                <h2 class="header-title">회원가입</h2>
            </header>

            <form class="signup-form" id="signup-form">
                <div class="form-card parent-section">
                    <h3 class="section-title"><span class="icon-user">👤</span> 보호자 정보</h3>
                    <div class="input-group">
                        <label>이름</label>
                        <input type="text" name="parentName" placeholder="이름을 입력하세요" required>
                    </div>
                    <div class="input-group">
                        <label>전화번호</label>
                        <input type="tel" name="parentPhone" placeholder="전화번호를 입력하세요" required>
                    </div>
                    <div class="input-group">
                        <label>아이디</label>
                        <input type="email" name="email" placeholder="아이디(이메일)를 입력하세요" required>
                    </div>
                    <div class="input-group">
                        <label>비밀번호</label>
                        <input type="password" name="password" placeholder="비밀번호를 입력하세요" required>
                    </div>
                </div>

                <div class="form-card patient-section">
                    <h3 class="section-title"><span class="icon-plus">➕</span> 환자 정보</h3>
                    <div class="info-notice">
                        <span class="info-icon">i</span>
                        가입 완료 시, 입력하신 환자 정보로 환자 전용 계정이 자동 생성됩니다.
                    </div>
                    <div class="input-group">
                        <label>환자 이름</label>
                        <input type="text" name="patientName" placeholder="환자 성함을 입력하세요" required>
                    </div>
                    <div class="input-group">
                        <label>환자 전화번호</label>
                        <input type="tel" name="patientPhone" placeholder="환자 전화번호를 입력하세요">
                    </div>
                    <div class="input-group">
                        <label>생년월일</label>
                        <input type="date" name="patientBirth" class="date-input">
                    </div>
                    
                    <div class="input-group">
                        <label>성별</label>
                        <div class="gender-selection-container">
                            <input type="radio" name="gender" value="male" id="male" checked>
                            <label for="male" class="gender-item">남성</label>
                            
                            <input type="radio" name="gender" value="female" id="female">
                            <label for="female" class="gender-item">여성</label>
                        </div>
                    </div>

                    <div class="input-group">
                        <label>환자용 아이디</label>
                        <input type="text" name="patientId" placeholder="아이디를 입력하세요">
                    </div>
                    <div class="input-group">
                        <label>환자용 비밀번호</label>
                        <input type="password" name="patientPw" placeholder="비밀번호를 입력하세요">
                    </div>
                </div>

                <div class="form-footer">
                    <div class="terms-row">
                        <input type="checkbox" id="terms-chk" required>
                        <label for="terms-chk">개인정보 수집 및 이용, 환자 정보 제공 서비스 이용 약관에 동의합니다. (필수)</label>
                    </div>

                    <button type="submit" class="submit-finish-btn">회원가입 완료</button>
                    <div class="login-link-area">
                        이미 계정이 있으신가요? <a href="/" data-link>로그인하기</a>
                    </div>
                </div>
            </form>
        </div>
    `;
}

export function attachSignupEvents() {
    const form = document.querySelector('#signup-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        
        try {
            // 1. Firebase Auth 계정 생성
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                formData.get('email'), 
                formData.get('password')
            );
            const user = userCredential.user;

            // 2. Firestore에 상세 정보 저장
            await setDoc(doc(db, "users", user.uid), {
                parentName: formData.get('parentName'),
                parentPhone: formData.get('parentPhone'),
                patientName: formData.get('patientName'),
                patientGender: formData.get('gender'),
                role: 'parent'
            });

            alert('회원가입이 완료되었습니다!');
            navigateTo('/');
        } catch (error) {
            alert('가입 실패: ' + error.message);
        }
    });
}