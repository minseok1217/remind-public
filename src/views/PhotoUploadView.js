import { storage, auth, db } from '../api/firebase.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export default function PhotoUploadView() {
    return `
        <div class="page-container">
            <header class="main-header flex-between">
                <h2 class="header-title">사진 등록</h2>
                <span class="text-mint" id="manage-photos">사진 관리</span>
            </header>

            <div class="upload-guide-box mt-20">
                AI가 통화 중 참고할 사진을 업로드하고 사진 속 인물이나 상황을 설명해주세요.
            </div>

            <div class="upload-zone mt-20" id="upload-trigger">
                <div class="upload-circle">
                    <span class="plus-icon">📷</span>
                </div>
                <p class="upload-main-text">사진 업로드</p>
                <p class="upload-sub-text">사진을 선택하거나 촬영하세요</p>
                <input type="file" id="photo-file" accept="image/*" style="display:none;">
            </div>

            <div id="upload-preview" class="image-preview-area" style="display:none; margin-top: 20px;"></div>

            <div class="mt-30">
                <label class="input-label">사진 설명</label>
                <textarea id="photo-description" class="desc-input" placeholder="이 사진에 대한 짧은 설명을 입력해주세요 (예: 웃고 있는 할머니 모습)"></textarea>
            </div>

            <button type="button" class="main-btn mt-40" id="upload-btn">등록 하기</button>
        </div>
    `;
}

// ⚠️ router.js에서 찾는 함수가 바로 이것입니다. 'export'를 꼭 확인하세요!
export function attachPhotoEvents() {
    const trigger = document.getElementById('upload-trigger');
    const fileInput = document.getElementById('photo-file');
    const uploadBtn = document.getElementById('upload-btn');
    const preview = document.getElementById('upload-preview');

    // 영역 클릭 시 파일 선택창 열기
    trigger?.addEventListener('click', () => fileInput.click());

    // 파일 선택 시 미리보기 렌더링
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.innerHTML = `
                    <div class="preview-wrapper">
                        <img src="${event.target.result}" style="width:100%; border-radius:15px;">
                        <button id="remove-photo" style="position:absolute; top:10px; right:10px;">X</button>
                    </div>`;
                preview.style.display = 'block';
                trigger.style.display = 'none'; // 업로드 전용 박스 숨김

                document.getElementById('remove-photo').onclick = () => {
                    fileInput.value = "";
                    preview.style.display = 'none';
                    trigger.style.display = 'block';
                };
            };
            reader.readAsDataURL(file);
        }
    });

    // Firebase 업로드 로직
    uploadBtn?.addEventListener('click', async () => {
        const file = fileInput.files[0];
        const description = document.getElementById('photo-description').value;

        if (!file) return alert("사진을 선택해주세요!");

        try {
            uploadBtn.innerText = "등록 중...";
            uploadBtn.disabled = true;

            // 1. Storage 업로드 (사용자별 폴더 구분)
            const storageRef = ref(storage, `memories/${auth.currentUser?.uid || 'guest'}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            // 2. Firestore에 사진 정보 저장
            await addDoc(collection(db, "photos"), {
                userId: auth.currentUser?.uid || 'guest',
                imageUrl: url,
                description: description,
                createdAt: serverTimestamp()
            });

            alert("사진이 성공적으로 등록되었습니다!");
            location.reload(); // 업로드 후 초기화

        } catch (error) {
            console.error("업로드 실패:", error);
            alert("업로드 중 오류가 발생했습니다.");
            uploadBtn.innerText = "등록 하기";
            uploadBtn.disabled = false;
        }
    });
}