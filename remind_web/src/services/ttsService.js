const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
const VOICE_ID = '8jHHF8rMqMlg8if2mOUe';

// 순우리말 수사 변환 (1~99)
const _NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const _NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

function toNativeKorean(n) {
  if (n <= 0 || n >= 100) return String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return _NATIVE_ONES[ones];
  if (ones === 0) return _NATIVE_TENS[tens];
  return _NATIVE_TENS[tens] + _NATIVE_ONES[ones];
}

// 순우리말 수사를 써야 하는 단위 앞의 숫자를 변환
const _NATIVE_COUNTER_RE = /(\d+)\s*(문제|개|명|마리|장|권|잔|병|그루|살|가지|줄|대|채|켤레|벌|쌍|쪽|자루|송이|포기|다발|묶음|바퀴|판|걸음)/g;

function preprocessTTS(text) {
  return text.replace(_NATIVE_COUNTER_RE, (_, num, counter) => {
    const n = parseInt(num, 10);
    return (n >= 1 && n <= 99) ? toNativeKorean(n) + counter : _ ;
  });
}

let currentAudio = null;
let currentAbortController = null;
let ttsGeneration = 0;

// 원래 코드
// export const cancelTTS = () => {
//   ttsGeneration += 1;
//   if (currentAbortController) {
//     try { currentAbortController.abort(); } catch {}
//     currentAbortController = null;
//   }
//   window.speechSynthesis.cancel();
//   if (currentAudio) {
//     try { currentAudio.pause(); } catch {}
//     try { currentAudio.src = ''; } catch {}
//     currentAudio = null;
//   }
// };

export const cancelTTS = () => {
  ttsGeneration += 1;

  if (currentAbortController) {
    try { currentAbortController.abort(); } catch {}
    currentAbortController = null;
  }

  try {
    if (window?.speechSynthesis?.cancel) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    console.warn('cancelTTS error:', e);
  }

  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch {}
    currentAudio = null;
  }
};

export const webSpeak = (text, generation = ttsGeneration) =>
  new Promise((resolve) => {
    window.speechSynthesis.cancel();
    if (generation !== ttsGeneration) {
      resolve();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.85;
    u.pitch = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    u.onstart = () => {
      if (generation !== ttsGeneration) {
        window.speechSynthesis.cancel();
        resolve();
      }
    };
    window.speechSynthesis.speak(u);
    // Chrome 버그: 긴 텍스트에서 speechSynthesis가 멈추는 현상 방지
    setTimeout(() => {
      if (generation === ttsGeneration && window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 300);
  });

export const tts = async (rawText, options = {}) => {
  const text = preprocessTTS(rawText);
  const generation = ttsGeneration;
  if (!ELEVENLABS_API_KEY) return webSpeak(text, generation);
  const abortController = new AbortController();
  currentAbortController = abortController;
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (currentAbortController === abortController) currentAbortController = null;
    if (generation !== ttsGeneration) return;
    if (!r.ok) {
      console.warn(`[TTS] ElevenLabs ${r.status} → webSpeak 전환`);
      return webSpeak(text, generation);
    }
    const blob = await r.blob();
    await options.onAudioBlob?.(blob, text);
    if (generation !== ttsGeneration) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    return new Promise((resolve) => {
      let cleanedUp = false;
      const cleanup = (fallback = false) => {
        if (cleanedUp) return;
        cleanedUp = true;
        try { audio.pause(); audio.src = ''; } catch {}
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (fallback && generation === ttsGeneration) return webSpeak(text, generation).then(resolve);
        resolve();
      };
      audio.onended = () => cleanup(false);
      audio.onerror = () => cleanup(true);
      if (generation !== ttsGeneration) {
        cleanup(false);
        return;
      }
      audio.play().catch(() => cleanup(true));
    });
  } catch (err) {
    if (currentAbortController === abortController) currentAbortController = null;
    if (err?.name === 'AbortError' || generation !== ttsGeneration) return;
    console.warn('[TTS] 네트워크 오류:', err);
    return webSpeak(text, generation);
  }
};
