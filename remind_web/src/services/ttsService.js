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
const STREAM_MIME_TYPE = 'audio/mpeg';

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

export const pauseTTS = () => {
  if (currentAudio && !currentAudio.paused) {
    try { currentAudio.pause(); } catch {}
  }
  try {
    if (window?.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  } catch {}
};

export const resumeTTS = () => {
  if (currentAudio && currentAudio.paused && currentAudio.src) {
    try { currentAudio.play().catch(() => {}); } catch {}
  }
  try {
    if (window?.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}
};

export const isTTSPaused = () => {
  if (currentAudio && currentAudio.paused && currentAudio.src) return true;
  if (window?.speechSynthesis?.paused) return true;
  return false;
};

export const isTTSPlaying = () => {
  if (currentAudio && !currentAudio.paused) return true;
  if (window?.speechSynthesis?.speaking && !window.speechSynthesis.paused) return true;
  return false;
};

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
  } catch {
  }

  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch {}
    currentAudio = null;
  }
};

export const webSpeak = (text, generation = ttsGeneration, options = {}) =>
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
        return;
      }
      options.onSpeechStart?.();
    };
    window.speechSynthesis.speak(u);
    // Chrome 버그: 긴 텍스트에서 speechSynthesis가 멈추는 현상 방지
    setTimeout(() => {
      if (generation === ttsGeneration && window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 300);
  });

const appendSourceBuffer = (sourceBuffer, chunk) =>
  new Promise((resolve, reject) => {
    const onUpdateEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('MediaSource append failed'));
    };
    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', onUpdateEnd);
      sourceBuffer.removeEventListener('error', onError);
    };
    sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
    sourceBuffer.addEventListener('error', onError, { once: true });
    sourceBuffer.appendBuffer(chunk);
  });

const ttsStream = async (text, generation, options = {}) => {
  if (!ELEVENLABS_API_KEY || !window.MediaSource || !MediaSource.isTypeSupported(STREAM_MIME_TYPE)) {
    return tts(text, { ...options, stream: false });
  }

  const abortController = new AbortController();
  currentAbortController = abortController;
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  const audio = new Audio(url);
  currentAudio = audio;

  let objectUrlRevoked = false;
  const cleanup = () => {
    if (objectUrlRevoked) return;
    objectUrlRevoked = true;
    try { audio.pause(); audio.src = ''; } catch {}
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
    if (currentAbortController === abortController) currentAbortController = null;
  };

  return new Promise((resolve) => {
    let resolved = false;
    let collectedChunks = [];

    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve();
    };
    const fallbackToStandardTTS = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      tts(text, { ...options, stream: false }).then(resolve);
    };

    audio.onplay = () => {
      if (generation === ttsGeneration) options.onSpeechStart?.();
    };
    audio.onended = finish;
    audio.onerror = finish;

    mediaSource.addEventListener('sourceopen', async () => {
      let sourceBuffer = null;
      try {
        if (generation !== ttsGeneration) {
          finish();
          return;
        }

        sourceBuffer = mediaSource.addSourceBuffer(STREAM_MIME_TYPE);
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`,
          {
            method: 'POST',
            signal: abortController.signal,
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              Accept: STREAM_MIME_TYPE,
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          }
        );

        if (!response.ok || !response.body || generation !== ttsGeneration) {
          if (generation === ttsGeneration) fallbackToStandardTTS();
          else finish();
          return;
        }

        const reader = response.body.getReader();
        let startedPlayback = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done || generation !== ttsGeneration) break;
          if (!value?.length) continue;

          const chunk = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          collectedChunks.push(chunk);
          await appendSourceBuffer(sourceBuffer, chunk);

          if (!startedPlayback) {
            startedPlayback = true;
            audio.play().catch(() => {});
          }
        }

        if (generation === ttsGeneration && collectedChunks.length) {
          try {
            const blob = new Blob(collectedChunks, { type: STREAM_MIME_TYPE });
            Promise.resolve(options.onAudioBlob?.(blob, text)).catch(() => {});
          } catch {}
        }

        if (mediaSource.readyState === 'open') {
          try { mediaSource.endOfStream(); } catch {}
        }
      } catch (err) {
        if (err?.name !== 'AbortError' && generation === ttsGeneration) {
          try { if (mediaSource.readyState === 'open') mediaSource.endOfStream('network'); } catch {}
          fallbackToStandardTTS();
          return;
        }
        finish();
      }
    }, { once: true });
  });
};

export const tts = async (rawText, options = {}) => {
  const text = preprocessTTS(rawText);
  const generation = ttsGeneration;
  if (options.preferBrowser) return webSpeak(text, generation, options);
  if (options.stream) return ttsStream(text, generation, options);
  if (!ELEVENLABS_API_KEY) return webSpeak(text, generation, options);
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
      return webSpeak(text, generation, options);
    }
    const blob = await r.blob();
    try {
      Promise.resolve(options.onAudioBlob?.(blob, text)).catch(() => {});
    } catch {}
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
        if (fallback && generation === ttsGeneration) return webSpeak(text, generation, options).then(resolve);
        resolve();
      };
      audio.onended = () => cleanup(false);
      audio.onerror = () => cleanup(true);
      audio.onplay = () => {
        if (generation === ttsGeneration) options.onSpeechStart?.();
      };
      if (generation !== ttsGeneration) {
        cleanup(false);
        return;
      }
      audio.play().catch(() => cleanup(true));
    });
  } catch (err) {
    if (currentAbortController === abortController) currentAbortController = null;
    if (err?.name === 'AbortError' || generation !== ttsGeneration) return;
    return webSpeak(text, generation, options);
  }
};
