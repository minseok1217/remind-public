import { useRef, useState } from 'react';
import { useScribe } from '@elevenlabs/react';

const SCRIBE_TOKEN_ENDPOINT =
  import.meta.env.VITE_ELEVENLABS_SCRIBE_TOKEN_ENDPOINT || '/api/elevenlabs/scribe-token';

const DEFAULT_NO_RESULT_MS = 16000;
const DEFAULT_FINALIZE_DELAY_MS = 2400;
const DEFAULT_WEB_SPEECH_SILENCE_MS = 1800;

export const useScribeSpeechRecognition = ({
  noResultMs = DEFAULT_NO_RESULT_MS,
  finalizeDelayMs = DEFAULT_FINALIZE_DELAY_MS,
  webSpeechSilenceMs = DEFAULT_WEB_SPEECH_SILENCE_MS,
  preferWebSpeech = false,
} = {}) => {
  const [isListening, setIsListening] = useState(false);
  const androidSpeechSupported = !!window.AndroidSpeechBridge?.startListening;
  const scribeSupported = !!(navigator.mediaDevices?.getUserMedia && window.WebSocket);
  const webSpeechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = androidSpeechSupported || scribeSupported || webSpeechSupported;
  const onResultRef = useRef(null);
  const onNoResultRef = useRef(null);
  const onTranscriptRef = useRef(null);
  const timeoutRef = useRef(null);
  const finalizeTimerRef = useRef(null);
  const finalizeDelayRef = useRef(finalizeDelayMs);
  const completedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const webRecognitionRef = useRef(null);
  const transcriptBufferRef = useRef('');
  const scribeFailedRef = useRef(false);
  const scribeConsecutiveFailsRef = useRef(0);
  const listenStartedAtRef = useRef(0);
  const activeProviderRef = useRef('none');

  const cleanupTimer = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    clearTimeout(finalizeTimerRef.current);
    finalizeTimerRef.current = null;
  };

  const safeDisconnect = () => {
    try {
      scribe.disconnect();
    } catch {
      // WebSocket may already be closed or not connected yet.
    }
  };

  const finish = (text) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const elapsedMs = listenStartedAtRef.current
      ? Math.round(performance.now() - listenStartedAtRef.current)
      : null;
    cleanupTimer();
    setIsListening(false);
    safeDisconnect();

    const trimmed = (text || '').trim();
    console.log('[VoiceTiming][STT] 최종 처리:', {
      provider: activeProviderRef.current,
      elapsedMs,
      hasText: Boolean(trimmed),
      textLength: trimmed.length,
    });
    if (trimmed) {
      scribeConsecutiveFailsRef.current = 0;
      onResultRef.current?.(trimmed);
    } else {
      scribeConsecutiveFailsRef.current += 1;
      if (scribeConsecutiveFailsRef.current >= 2) {
        scribeFailedRef.current = true;
      }
      onNoResultRef.current?.();
    }
  };

  const appendTranscript = (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || completedRef.current) return;
    transcriptBufferRef.current = `${transcriptBufferRef.current} ${trimmed}`.replace(/\s+/g, ' ').trim();
    onTranscriptRef.current?.(transcriptBufferRef.current);
    clearTimeout(finalizeTimerRef.current);
    finalizeTimerRef.current = setTimeout(() => {
      finish(transcriptBufferRef.current);
    }, finalizeDelayRef.current);
  };

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    languageCode: 'ko',
    commitStrategy: 'vad',
    vadSilenceThresholdSecs: 2.4,
    minSpeechDurationMs: 120,
    minSilenceDurationMs: 600,
    noVerbatim: true,
    onCommittedTranscript: (data) => appendTranscript(data.text),
    onCommittedTranscriptWithTimestamps: (data) => appendTranscript(data.text),
    onError: () => finish(''),
    onAuthError: () => finish(''),
    onQuotaExceededError: () => finish(''),
    onRateLimitedError: () => finish(''),
    onInputError: () => finish(''),
    onInsufficientAudioActivityError: () => finish(''),
  });

  const fetchScribeToken = async () => {
    const startAt = performance.now();
    const response = await fetch(SCRIBE_TOKEN_ENDPOINT);
    const data = await response.json().catch(() => ({}));
    console.log('[VoiceTiming][STT][Scribe] 토큰 응답:', {
      elapsedMs: Math.round(performance.now() - startAt),
      ok: response.ok,
      hasToken: Boolean(data.token),
    });
    if (!response.ok || !data.token) {
      scribeFailedRef.current = true;
      throw new Error(data.error || 'Scribe token request failed');
    }
    return data.token;
  };

  const startListeningWebSpeech = (onResult, onNoResult, onTranscript, silenceMs = webSpeechSilenceMs, sessionId) => {
    activeProviderRef.current = 'webSpeech';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onNoResult?.();
      return;
    }

    const rec = new SR();
    webRecognitionRef.current = rec;
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    setIsListening(true);

    let done = false;
    let finalTranscript = '';
    let interimTranscript = '';
    let silenceTimer = null;

    const clearSilenceTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    };

    const finishWebSpeech = (text) => {
      if (sessionIdRef.current !== sessionId) return;
      if (done) return;
      done = true;
      console.log('[VoiceTiming][STT][WebSpeech] 완료:', {
        sessionId,
        elapsedMs: listenStartedAtRef.current
          ? Math.round(performance.now() - listenStartedAtRef.current)
          : null,
        hasText: Boolean((text || '').trim()),
      });
      clearSilenceTimer();
      try {
        rec.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }
      if (webRecognitionRef.current === rec) webRecognitionRef.current = null;
      setIsListening(false);
      const trimmed = (text || '').trim();
      if (trimmed) onResult?.(trimmed);
      else onNoResult?.();
    };

    const finishCurrent = () => {
      finishWebSpeech(`${finalTranscript} ${interimTranscript}`.replace(/\s+/g, ' '));
    };

    rec.onresult = (event) => {
      if (sessionIdRef.current !== sessionId) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) finalTranscript = `${finalTranscript} ${transcript}`.trim();
        else interim += transcript;
      }
      interimTranscript = interim.trim();
      const preview = `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, ' ').trim();
      if (preview) onTranscript?.(preview);
      clearSilenceTimer();
      silenceTimer = setTimeout(finishCurrent, silenceMs);
    };

    rec.onerror = (event) => {
      if (sessionIdRef.current !== sessionId) return;
      if (event.error === 'no-speech') finishCurrent();
      else finishWebSpeech('');
    };

    rec.onend = () => {
      if (sessionIdRef.current !== sessionId) return;
      if (!done) finishCurrent();
    };

    try {
      rec.start();
    } catch {
      finishWebSpeech('');
    }
  };

  const startListeningAndroid = (onResult, onNoResult, onTranscript, sessionId, noResultTimeoutMs) => {
    activeProviderRef.current = 'android';
    if (!window.AndroidSpeechBridge?.startListening) {
      console.warn('[SpeechDebug] AndroidSpeechBridge 없음');
      onNoResult?.();
      return;
    }

    console.log(`[SpeechDebug] Android 네이티브 음성인식 시작 요청: sessionId=${sessionId}`);
    setIsListening(true);
    timeoutRef.current = setTimeout(() => {
      if (sessionIdRef.current !== sessionId) return;
      console.warn(`[SpeechDebug] Android 음성인식 타임아웃: sessionId=${sessionId}, timeoutMs=${noResultTimeoutMs}`);
      try {
        window.AndroidSpeechBridge.stopListening?.();
      } catch {
        // Native bridge may already be stopped.
      }
      setIsListening(false);
      onNoResult?.();
    }, noResultTimeoutMs);

    window.__androidSpeechOnTranscript = (text) => {
      if (sessionIdRef.current !== sessionId) return;
      console.log(`[SpeechDebug] Android 중간 인식: sessionId=${sessionId}, text=${text}`);
      onTranscript?.(text || '');
    };

    window.__androidSpeechOnResult = (text) => {
      if (sessionIdRef.current !== sessionId) return;
      cleanupTimer();
      setIsListening(false);
      const trimmed = (text || '').trim();
      console.log('[VoiceTiming][STT][Android] 완료:', {
        sessionId,
        elapsedMs: listenStartedAtRef.current
          ? Math.round(performance.now() - listenStartedAtRef.current)
          : null,
        hasText: Boolean(trimmed),
        textLength: trimmed.length,
      });
      console.log(`[SpeechDebug] Android 최종 인식: sessionId=${sessionId}, hasText=${Boolean(trimmed)}, text=${trimmed}`);
      if (trimmed) onResult?.(trimmed);
      else onNoResult?.();
    };

    window.__androidSpeechOnNoResult = () => {
      if (sessionIdRef.current !== sessionId) return;
      cleanupTimer();
      setIsListening(false);
      console.warn(`[SpeechDebug] Android 인식 결과 없음: sessionId=${sessionId}`);
      onNoResult?.();
    };

    window.__androidSpeechOnError = (code, label) => {
      if (sessionIdRef.current !== sessionId) return;
      cleanupTimer();
      setIsListening(false);
      console.warn(`[SpeechDebug] Android 음성인식 오류: sessionId=${sessionId}, code=${code}, label=${label || 'unknown'}`);
      onNoResult?.();
    };

    try {
      window.AndroidSpeechBridge.startListening();
    } catch {
      cleanupTimer();
      setIsListening(false);
      console.error('[SpeechDebug] AndroidSpeechBridge.startListening 호출 실패');
      onNoResult?.();
    }
  };

  const startListening = async (onResult, onNoResult, options = {}) => {
    const currentNoResultMs = options.noResultMs || noResultMs;
    const currentFinalizeDelayMs = options.finalizeDelayMs || finalizeDelayMs;
    const currentWebSpeechSilenceMs = options.webSpeechSilenceMs || webSpeechSilenceMs;
    safeDisconnect();
    try {
      webRecognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped by the browser.
    }
    cleanupTimer();
    completedRef.current = false;
    const sessionId = sessionIdRef.current + 1;
    sessionIdRef.current = sessionId;
    listenStartedAtRef.current = performance.now();
    activeProviderRef.current = 'pending';
    finalizeDelayRef.current = currentFinalizeDelayMs;
    transcriptBufferRef.current = '';
    onResultRef.current = onResult;
    onNoResultRef.current = onNoResult;
    onTranscriptRef.current = options.onTranscript || null;

    console.log(`[SpeechDebug] startListening: sessionId=${sessionId}, android=${androidSpeechSupported}, scribe=${scribeSupported}, webSpeech=${webSpeechSupported}, scribeFailed=${scribeFailedRef.current}, preferWebSpeech=${preferWebSpeech}`);

    if (androidSpeechSupported) {
      startListeningAndroid(onResult, onNoResult, options.onTranscript, sessionId, currentNoResultMs);
      return;
    }

    if ((preferWebSpeech && webSpeechSupported) || !scribeSupported || scribeFailedRef.current) {
      console.log('[SpeechDebug] Web Speech 인식 경로 사용:', { sessionId });
      startListeningWebSpeech(onResult, onNoResult, options.onTranscript, currentWebSpeechSilenceMs, sessionId);
      return;
    }

    setIsListening(true);
    timeoutRef.current = setTimeout(() => finish(''), currentNoResultMs);
    try {
      activeProviderRef.current = 'elevenlabs-scribe';
      console.log('[SpeechDebug] Scribe 토큰 요청:', { sessionId, endpoint: SCRIBE_TOKEN_ENDPOINT });
      const token = await fetchScribeToken();
      const connectStartAt = performance.now();
      console.log('[SpeechDebug] Scribe 연결 시작:', { sessionId });
      await scribe.connect({
        token,
        modelId: 'scribe_v2_realtime',
        languageCode: 'ko',
        commitStrategy: 'vad',
        vadSilenceThresholdSecs: currentFinalizeDelayMs / 1000,
        minSpeechDurationMs: 120,
        minSilenceDurationMs: 600,
        noVerbatim: true,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      console.log('[VoiceTiming][STT][Scribe] 연결 완료:', {
        sessionId,
        elapsedMs: Math.round(performance.now() - connectStartAt),
        totalElapsedMs: Math.round(performance.now() - listenStartedAtRef.current),
      });
      const conn = scribe.getConnection?.();
      if (conn?.send) {
        const origSend = conn.send.bind(conn);
        conn.send = (data) => {
          try {
            origSend(data);
          } catch {
            // Ignore leftover audio chunks after disconnect.
          }
        };
      }
    } catch {
      console.warn('[SpeechDebug] Scribe 실패, Web Speech fallback 시도:', { sessionId });
      cleanupTimer();
      setIsListening(false);
      startListeningWebSpeech(onResult, onNoResult, options.onTranscript, currentWebSpeechSilenceMs, sessionId);
    }
  };

  const stopListening = () => {
    console.log('[SpeechDebug] stopListening');
    sessionIdRef.current += 1;
    completedRef.current = true;
    cleanupTimer();
    safeDisconnect();
    try {
      webRecognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped by the browser.
    }
    try {
      window.AndroidSpeechBridge?.stopListening?.();
    } catch {
      // Native bridge may already be stopped.
    }
    delete window.__androidSpeechOnTranscript;
    delete window.__androidSpeechOnResult;
    delete window.__androidSpeechOnNoResult;
    delete window.__androidSpeechOnError;
    webRecognitionRef.current = null;
    setIsListening(false);
  };

  return { isListening, supported, startListening, stopListening };
};
