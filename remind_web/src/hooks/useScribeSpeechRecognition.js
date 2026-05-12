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
  const scribeSupported = !!(navigator.mediaDevices?.getUserMedia && window.WebSocket);
  const webSpeechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = scribeSupported || webSpeechSupported;
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
    cleanupTimer();
    setIsListening(false);
    safeDisconnect();

    const trimmed = (text || '').trim();
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
    const response = await fetch(SCRIBE_TOKEN_ENDPOINT);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      scribeFailedRef.current = true;
      throw new Error(data.error || 'Scribe token request failed');
    }
    return data.token;
  };

  const startListeningWebSpeech = (onResult, onNoResult, onTranscript, silenceMs = webSpeechSilenceMs, sessionId) => {
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
    finalizeDelayRef.current = currentFinalizeDelayMs;
    transcriptBufferRef.current = '';
    onResultRef.current = onResult;
    onNoResultRef.current = onNoResult;
    onTranscriptRef.current = options.onTranscript || null;

    if ((preferWebSpeech && webSpeechSupported) || !scribeSupported || scribeFailedRef.current) {
      startListeningWebSpeech(onResult, onNoResult, options.onTranscript, currentWebSpeechSilenceMs, sessionId);
      return;
    }

    setIsListening(true);
    timeoutRef.current = setTimeout(() => finish(''), currentNoResultMs);
    try {
      const token = await fetchScribeToken();
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
      cleanupTimer();
      setIsListening(false);
      startListeningWebSpeech(onResult, onNoResult, options.onTranscript, currentWebSpeechSilenceMs, sessionId);
    }
  };

  const stopListening = () => {
    sessionIdRef.current += 1;
    completedRef.current = true;
    cleanupTimer();
    safeDisconnect();
    try {
      webRecognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped by the browser.
    }
    webRecognitionRef.current = null;
    setIsListening(false);
  };

  return { isListening, supported, startListening, stopListening };
};
