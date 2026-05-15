const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
const VOICE_ID = '8jHHF8rMqMlg8if2mOUe';

let currentAudio = null;

// export const cancelTTS = () => {
//   window.speechSynthesis.cancel();
//   if (currentAudio) {
//     try { currentAudio.pause(); } catch {}
//     currentAudio = null;
//   }
// };

export const cancelTTS = () => {
  try {
    if (window?.speechSynthesis?.cancel) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    console.warn('cancelTTS error:', e);
  }

  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {}

    currentAudio = null;
  }
};

export const webSpeak = (text) =>
  new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.85;
    u.pitch = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
    // Chrome 버그: 긴 텍스트에서 speechSynthesis가 멈추는 현상 방지
    setTimeout(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 300);
  });

export const tts = async (text) => {
  if (!ELEVENLABS_API_KEY) return webSpeak(text);
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
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
    if (!r.ok) {
      console.warn(`[TTS] ElevenLabs ${r.status} → webSpeak 전환`);
      return webSpeak(text);
    }
    const blob = await r.blob();
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
        if (fallback) return webSpeak(text).then(resolve);
        resolve();
      };
      audio.onended = () => cleanup(false);
      audio.onerror = () => cleanup(true);
      audio.play().catch(() => cleanup(true));
    });
  } catch (err) {
    console.warn('[TTS] 네트워크 오류:', err);
    return webSpeak(text);
  }
};
