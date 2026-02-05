



export function attachChatEvents() {
    const micBtn = document.getElementById('mic-btn');
    const statusMsg = document.getElementById('status-msg');
    const captionArea = document.getElementById('caption-area');
    const backBtn = document.getElementById('chat-back-btn');
    const photoArea = document.getElementById('photo-area');
    const memoryPhoto = document.getElementById('memory-photo');
    const photoDescTag = document.getElementById('photo-desc-tag');

    let chatSession = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let isSpeaking = false;
    let ttsQueue = [];

    // VAD 설정
    let audioContext = null;
    let analyser = null;
    let silenceTimer = null;
    let animationFrameId = null;
    const SILENCE_THRESHOLD = 15; 
    const SILENCE_DURATION = 1600; 

    // ----------------------------------------------------
    // [1] Firestore에서 최신 사진 동적 로드
    // ----------------------------------------------------
    const loadLatestPhoto = async () => {
        try {
            const photosRef = collection(db, "photos");
            const q = query(photosRef, orderBy("uploadDate", "desc"), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const data = querySnapshot.docs[0].data();
                memoryPhoto.src = data.imageUrl;
                photoArea.style.display = 'block';
                photoDescTag.innerText = data.description || "소중한 추억";
                
                return {
                    desc: data.description || "추억 사진",
                    tag: data.tag || "일상"
                };
            }
            return null;
        } catch (error) {
            console.error("사진 로드 실패:", error);
            return null;
        }
    };

    // ----------------------------------------------------
    // [2] 초기화 및 AI 세션 설정
    // ----------------------------------------------------
    const initChat = async () => {
        const photoInfo = await loadLatestPhoto();
        
        try {
            const model = getGenerativeModel();
            const photoContext = photoInfo 
                ? `현재 어르신은 "${photoInfo.desc}"라는 설명이 적힌 사진을 보고 계십니다. 태그는 "${photoInfo.tag}"입니다. 이 정보를 바탕으로 첫 인사를 건네고 질문해 주세요.` 
                : "어르신과 따뜻한 인사를 나누며 대화를 시작해 주세요.";

            const systemInstruction = `
            당신은 치매 노인을 위한 다정한 '회상 치료사'입니다.
            ${photoContext}
            [대화 규칙]
            1. 답변은 1~2문장으로 짧고 천천히 하세요.
            2. 어르신이 피곤해하거나 끝내려 하면 따뜻하게 인사 후 마지막에 [END_CALL]을 붙이세요.
            `;

            chatSession = model.startChat({
                history: [
                    { role: "user", parts: [{ text: systemInstruction }] },
                    { role: "model", parts: [{ text: "네, 사진을 보며 어르신과 즐겁게 대화하겠습니다." }] }
                ]
            });

            statusMsg.innerText = "마이크를 눌러 대화를 시작하세요.";
            updateUIState('ready');
        } catch (error) {
            statusMsg.innerText = "연결 오류가 발생했습니다.";
        }
    };

    // ----------------------------------------------------
    // [3] 음성 감지(VAD) 루프
    // ----------------------------------------------------
    const watchVoiceActivity = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const check = () => {
            if (!isRecording) return;
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

            if (volume > SILENCE_THRESHOLD) {
                if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
                statusMsg.innerText = "듣고 있어요... 🎙️";
            } else {
                if (!silenceTimer) {
                    silenceTimer = setTimeout(() => stopRecording(), SILENCE_DURATION);
                }
            }
            animationFrameId = requestAnimationFrame(check);
        };
        check();
    };

    const startRecording = async () => {
        if (isRecording || isSpeaking) return;
        try {
            stopSpeaking();
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });

            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                audioContext.createMediaStreamSource(stream).connect(analyser);
            }

            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendAudioStream(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            updateUIState('recording');
            watchVoiceActivity();
        } catch (err) {
            alert("마이크 권한을 허용해 주세요.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
        isRecording = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    // ----------------------------------------------------
    // [4] Gemini 통신 및 TTS
    // ----------------------------------------------------
    const sendAudioStream = async (audioBlob) => {
        try {
            updateUIState('processing');
            captionArea.innerText = "";
            const base64Audio = await blobToBase64(audioBlob);
            
            const result = await chatSession.sendMessageStream([
                { inlineData: { data: base64Audio, mimeType: "audio/webm" } }
            ]);

            let fullText = "";
            let buffer = "";

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;
                buffer += chunkText;

                if (/[.?!](\s|$)/.test(buffer)) {
                    let speakText = buffer.replace('[END_CALL]', '').trim();
                    if (speakText) addToTTSQueue(speakText);
                    buffer = "";
                }
                captionArea.innerText = fullText.replace('[END_CALL]', '');
            }

            if (buffer.trim()) {
                let speakText = buffer.replace('[END_CALL]', '').trim();
                if (speakText) addToTTSQueue(speakText);
            }

            if (fullText.includes('[END_CALL]')) {
                setTimeout(() => history.back(), 5000);
            }
        } catch (error) {
            statusMsg.innerText = "다시 말씀해 주세요.";
            setTimeout(startRecording, 2000);
        }
    };

    const playHighQualityTTS = async (text) => {
        try {
            const response = await fetch("http://localhost:3000/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            const audio = new Audio(url);
            return new Promise((r) => { 
                audio.onended = () => { URL.revokeObjectURL(url); r(); }; 
                audio.play(); 
            });
        } catch (e) { return fallbackSpeak(text); }
    };

    const fallbackSpeak = (text) => {
        return new Promise((r) => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ko-KR'; u.onend = r;
            window.speechSynthesis.speak(u);
        });
    };

    const addToTTSQueue = (text) => {
        ttsQueue.push(text);
        if (!isSpeaking) processTTSQueue();
    };

    const processTTSQueue = async () => {
        if (ttsQueue.length === 0) {
            isSpeaking = false;
            if (!captionArea.innerText.includes('[END_CALL]')) setTimeout(startRecording, 500);
            return;
        }
        isSpeaking = true;
        await playHighQualityTTS(ttsQueue.shift());
        processTTSQueue();
    };

    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        ttsQueue = []; isSpeaking = false;
    };

    const updateUIState = (state) => {
        micBtn.className = 'mic-btn ' + state;
        if (state === 'recording') {
            statusMsg.innerText = "듣고 있어요...";
            micBtn.innerHTML = '<span class="icon">⏹️</span><span class="label">말 끝남</span>';
        } else if (state === 'processing') {
            statusMsg.innerText = "생각 중...";
            micBtn.innerHTML = '<span class="icon">⌛</span><span class="label">대답 중</span>';
        } else {
            statusMsg.innerText = "마이크를 눌러 대화를 시작하세요.";
            micBtn.innerHTML = '<span class="icon">🎙️</span><span class="label">시작하기</span>';
        }
    };

    const blobToBase64 = (b) => new Promise((r) => {
        const f = new FileReader(); f.onloadend = () => r(f.result.split(',')[1]); f.readAsDataURL(b);
    });

    micBtn.onclick = () => {
        if (!isRecording && !isSpeaking) startRecording();
        else if (isRecording) stopRecording();
    };

    if (backBtn) backBtn.onclick = () => { stopSpeaking(); history.back(); };

    initChat();
}