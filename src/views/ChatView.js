import { getGenerativeModel } from "../api/gemini.js";

// 1. UI 렌더링
export default function ChatView() {
    return `
        <div class="chat-container call-mode">
            <header class="chat-header">
                <button class="back-btn" id="chat-back-btn">〈 종료</button>
                <h2>추억 파트너</h2>
            </header>

            <div class="call-interface">
                <div class="ai-avatar">
                    <img src="assets/therapist_avatar.png" alt="AI 상담사" onerror="this.src='https://via.placeholder.com/150/87CEEB/ffffff?text=AI'">
                </div>

                <div id="status-msg" class="status-message">
                    반갑습니다, 어르신.<br>마이크를 누르고 말씀해 주세요.
                </div>

                <div id="caption-area" class="caption-area"></div>

                <div class="control-area">
                    <button id="mic-btn" class="mic-btn ready">
                        <span class="icon">🎙️</span>
                        <span class="label">말하기</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 2. 핵심 로직
export function attachChatEvents() {
    // ⚠️ [필수] Google Cloud Console에서 발급받은 API 키 입력
    const GOOGLE_TTS_API_KEY = "여기에_GOOGLE_CLOUD_API_KEY_입력"; 

    const micBtn = document.getElementById('mic-btn');
    const statusMsg = document.getElementById('status-msg');
    const captionArea = document.getElementById('caption-area');
    const backBtn = document.getElementById('chat-back-btn');

    let chatSession = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    
    // TTS 큐 시스템
    let ttsQueue = [];
    let isSpeaking = false;

    // 뒤로가기 = 통화 종료
    if (backBtn) {
        backBtn.onclick = () => {
            stopSpeaking();
            history.back();
        };
    }

    // ----------------------------------------------------
    // [1] Google Cloud TTS (고품질 음성) 함수
    // ----------------------------------------------------
    const playHighQualityTTS = async (text) => {
        // API 키가 없으면 브라우저 기본 음성으로 대체
        if (!GOOGLE_TTS_API_KEY || GOOGLE_TTS_API_KEY.includes("입력")) {
            console.warn("Google TTS API 키가 없습니다. 기본 음성을 사용합니다.");
            return fallbackSpeak(text);
        }

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
        
        const requestBody = {
            input: { text: text },
            voice: { 
                languageCode: "ko-KR", 
                name: "ko-KR-Neural2-B" // 차분하고 따뜻한 상담사 톤
            },
            audioConfig: { 
                audioEncoding: "MP3",
                speakingRate: 0.9, // 어르신 맞춤 속도
                pitch: 0.0 
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.error) {
                console.error("TTS API Error:", data.error);
                return fallbackSpeak(text); // 실패 시 백업
            }

            // 오디오 재생
            const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
            return new Promise((resolve) => {
                audio.onended = () => resolve();
                audio.play();
            });

        } catch (error) {
            console.error("TTS 네트워크 오류:", error);
            return fallbackSpeak(text);
        }
    };

    // [백업용] 브라우저 기본 TTS
    const fallbackSpeak = (text) => {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 0.9;
            utterance.onend = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    };

    // ----------------------------------------------------
    // [2] TTS 큐 관리 (끊김 없는 대화)
    // ----------------------------------------------------
    const addToTTSQueue = (text) => {
        ttsQueue.push(text);
        if (!isSpeaking) processTTSQueue();
    };

    const processTTSQueue = async () => {
        if (ttsQueue.length === 0) {
            isSpeaking = false;
            return;
        }

        isSpeaking = true;
        const text = ttsQueue.shift();

        // 고품질 TTS 호출 (비동기 대기)
        await playHighQualityTTS(text);

        // 다음 문장 재생
        processTTSQueue();
    };

    const stopSpeaking = () => {
        window.speechSynthesis.cancel(); // 백업용 중단
        ttsQueue = []; // 큐 비우기
        isSpeaking = false;
    };

    // ----------------------------------------------------
    // [3] 초기화: 페르소나 설정
    // ----------------------------------------------------
    const initChat = async () => {
        try {
            const model = getGenerativeModel();
            
            const systemInstruction = `
            당신은 치매 노인을 위한 다정하고 침착한 '회상 치료사'입니다.
            상대방의 오디오를 듣고 따뜻하게 대답하세요.

            [대화 규칙]
            1. 답변은 어르신이 듣기 편하도록 **1~2문장** 이내로 짧고 천천히 하세요.
            2. 사용자가 피곤해하거나, 대화를 그만하고 싶어 하는 뉘앙스(긴 침묵, 짧은 단답형 대답 반복, "힘드네" 등)가 감지되면, 따뜻한 마무리 인사를 건네세요.
            3. 대화가 10턴 이상 지속되었고 특별한 화제가 없다면 건강을 기원하며 마무리를 유도하세요.
            4. 마무리 인사 맨 마지막에는 반드시 [END_CALL] 이라는 태그를 붙이세요. (예: "푹 쉬세요. [END_CALL]")
            `;

            chatSession = model.startChat({
                history: [
                    { role: "user", parts: [{ text: systemInstruction }] },
                    { role: "model", parts: [{ text: "네, 알겠습니다. 따뜻하게 대화하겠습니다." }] }
                ]
            });
            console.log("Chat Session Ready");

        } catch (error) {
            console.error("초기화 실패:", error);
            statusMsg.innerText = "연결 오류 발생. 새로고침 해주세요.";
        }
    };

    // ----------------------------------------------------
    // [4] 녹음 및 스트리밍 전송
    // ----------------------------------------------------
    const startRecording = async () => {
        try {
            stopSpeaking(); // 내가 말할 땐 AI 조용히
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 데이터 최적화 (16kbps)
            const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
            
            try {
                mediaRecorder = new MediaRecorder(stream, options);
            } catch (e) {
                mediaRecorder = new MediaRecorder(stream);
            }

            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendAudioStream(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            updateUIState('recording');

        } catch (err) {
            console.error("마이크 오류:", err);
            alert("마이크 권한을 허용해 주세요.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecording = false;
        updateUIState('processing');
    };

    // ----------------------------------------------------
    // [5] Gemini 스트리밍 통신 (핵심 로직)
    // ----------------------------------------------------
    const sendAudioStream = async (audioBlob) => {
        try {
            captionArea.innerText = "";
            const base64Audio = await blobToBase64(audioBlob);
            
            const audioPart = {
                inlineData: { data: base64Audio, mimeType: "audio/webm" }
            };

            const result = await chatSession.sendMessageStream([audioPart]);

            let fullText = "";
            let buffer = "";

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;
                buffer += chunkText;

                // 문장 단위(. ? !)로 잘라서 TTS 큐에 넣기
                if (/[.?!](\s|$)/.test(buffer)) {
                    let speakText = buffer.replace('[END_CALL]', '').trim();
                    if (speakText) {
                        addToTTSQueue(speakText);
                    }
                    buffer = ""; // 버퍼 비우기
                }
                
                // 화면 자막 업데이트
                captionArea.innerText = fullText.replace('[END_CALL]', '');
            }

            // 남은 버퍼 처리
            if (buffer.trim()) {
                let speakText = buffer.replace('[END_CALL]', '').trim();
                if (speakText) addToTTSQueue(speakText);
            }

            // [종료 신호 감지]
            if (fullText.includes('[END_CALL]')) {
                console.log("종료 신호 감지");
                setTimeout(() => {
                    alert("대화를 종료합니다. 건강하세요!");
                    history.back();
                }, 5000); // 마지막 인사말을 다 듣고 종료되도록 여유 시간 둠
            } else {
                updateUIState('ready');
            }

        } catch (error) {
            console.error("스트리밍 오류:", error);
            statusMsg.innerText = "잘 못 들었어요. 다시 말씀해 주세요.";
            updateUIState('ready');
        }
    };

    // ----------------------------------------------------
    // 유틸리티
    // ----------------------------------------------------
    const updateUIState = (state) => {
        micBtn.className = 'mic-btn ' + state;
        if (state === 'ready') {
            statusMsg.innerText = "마이크를 누르고 말씀해 주세요.";
            statusMsg.style.color = "#333";
            micBtn.innerHTML = '<span class="icon">🎙️</span><span class="label">말하기</span>';
        } else if (state === 'recording') {
            statusMsg.innerText = "듣고 있어요...";
            statusMsg.style.color = "#d32f2f";
            micBtn.innerHTML = '<span class="icon">⏹️</span><span class="label">다 했어요</span>';
        } else if (state === 'processing') {
            statusMsg.innerText = "대답하는 중...";
            statusMsg.style.color = "#1976d2";
            micBtn.innerHTML = '<span class="icon">🔊</span><span class="label">듣는 중</span>';
        }
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    micBtn.onclick = () => {
        if (!isRecording) startRecording();
        else stopRecording();
    };

    // 실행
    initChat();
}