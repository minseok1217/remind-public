/**
 * 텍스트-음성 변환 (TTS) 서비스
 * 
 * 두 가지 방식을 지원합니다:
 * 1. Web Speech API (무료, 브라우저 기본 탑재)
 * 2. Google Cloud Text-to-Speech API (고품질, 유료, API 키 필요)
 */

// ─────────────────────────────────────────────────────────────
// 방법 1: Web Speech API (무료)
// ─────────────────────────────────────────────────────────────

const webSpeechTTS = {
  speak: (text, options = {}) => {
    return new Promise((resolve, reject) => {
      // 브라우저 호환성 확인
      const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
      const speechSynthesis = window.speechSynthesis;
      
      if (!SpeechSynthesisUtterance || !speechSynthesis) {
        console.warn('Web Speech API를 지원하지 않습니다.');
        reject(new Error('Web Speech API is not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 설정
      utterance.lang = options.lang || 'ko-KR';
      utterance.rate = options.rate || 0.9; // 0.1 ~ 10, 기본값 1
      utterance.pitch = options.pitch || 1; // 0 ~ 2, 기본값 1
      utterance.volume = options.volume || 1; // 0 ~ 1, 기본값 1

      utterance.onstart = () => {
        console.log('🔊 음성 재생 시작');
        options.onStart?.();
      };

      utterance.onend = () => {
        console.log('🔊 음성 재생 완료');
        options.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ 음성 재생 오류:', event.error);
        options.onError?.(event.error);
        reject(new Error(event.error));
      };

      // 음성 재생
      speechSynthesis.cancel(); // 이전 재생 취소
      speechSynthesis.speak(utterance);
    });
  },

  stop: () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  },

  isSpeaking: () => {
    return window.speechSynthesis?.speaking || false;
  },

  getVoices: () => {
    return window.speechSynthesis?.getVoices() || [];
  }
};

// ─────────────────────────────────────────────────────────────
// 방법 2: Google Cloud Text-to-Speech API (고품질, 유료)
// ─────────────────────────────────────────────────────────────

const googleCloudTTS = {
  speak: async (text, options = {}) => {
    // Vite 환경에서 환경 변수 접근
    const apiKey = import.meta.env.REACT_APP_GOOGLE_TTS_API_KEY || '';
    
    if (!apiKey) {
      console.warn('Google Cloud TTS API 키가 설정되지 않았습니다.');
      console.warn('환경 변수 REACT_APP_GOOGLE_TTS_API_KEY를 설정해주세요.');
      // Fallback to Web Speech API
      return webSpeechTTS.speak(text, options);
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: options.lang || 'ko-KR',
              name: options.voiceName || 'ko-KR-Neural2-A', // Google의 한국어 음성
            },
            audioConfig: {
              audioEncoding: 'MP3',
              pitch: options.pitch || 0,
              speakingRate: options.rate || 1,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'TTS API 오류');
      }

      const data = await response.json();
      const audioBuffer = data.audioContent;

      // Base64 디코딩
      const binaryString = atob(audioBuffer);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 오디오 플레이
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onplay = () => {
        console.log('🔊 AI 음성 재생 시작');
        options.onStart?.();
      };

      audio.onended = () => {
        console.log('🔊 AI 음성 재생 완료');
        URL.revokeObjectURL(audioUrl);
        options.onEnd?.();
      };

      audio.onerror = (error) => {
        console.error('❌ 음성 재생 오류:', error);
        options.onError?.(error);
        throw error;
      };

      audio.play();
    } catch (error) {
      console.error('❌ Google Cloud TTS 오류:', error);
      // Fallback to Web Speech API
      return webSpeechTTS.speak(text, options);
    }
  },

  stop: () => {
    // Google Cloud TTS의 경우 Audio 태그 사용
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => audio.pause());
  }
};

// ─────────────────────────────────────────────────────────────
// 통합 TTS 서비스
// ─────────────────────────────────────────────────────────────

export const textToSpeech = {
  /**
   * 텍스트를 음성으로 재생합니다.
   * @param {string} text - 재생할 텍스트
   * @param {Object} options - 옵션
   * @param {string} options.method - 'web' (기본) 또는 'google'
   * @param {string} options.lang - 언어 코드 (기본: 'ko-KR')
   * @param {number} options.rate - 재생 속도 (기본: 0.9)
   * @param {number} options.pitch - 음정 (기본: 1)
   * @param {number} options.volume - 볼륨 (기본: 1)
   * @param {Function} options.onStart - 재생 시작 콜백
   * @param {Function} options.onEnd - 재생 완료 콜백
   * @param {Function} options.onError - 오류 콜백
   * @returns {Promise} 
   */
  speak: async (text, options = {}) => {
    const method = options.method || 'web'; // 기본값: Web Speech API

    if (method === 'google') {
      return googleCloudTTS.speak(text, options);
    } else {
      return webSpeechTTS.speak(text, options);
    }
  },

  /**
   * 음성 재생을 중지합니다.
   */
  stop: () => {
    webSpeechTTS.stop();
    googleCloudTTS.stop();
  },

  /**
   * 현재 음성 재생 상태를 반환합니다.
   * @returns {boolean}
   */
  isSpeaking: () => {
    return webSpeechTTS.isSpeaking();
  },

  /**
   * 사용 가능한 음성 목록을 반환합니다.
   * @returns {Array}
   */
  getVoices: () => {
    return webSpeechTTS.getVoices();
  },

  /**
   * TTS 설정 정보를 반환합니다.
   * @returns {Object}
   */
  getInfo: () => {
    const apiKey = import.meta.env.REACT_APP_GOOGLE_TTS_API_KEY || '';
    return {
      webSpeechSupported: !!window.SpeechSynthesisUtterance,
      googleCloudApiKeySet: !!apiKey,
      availableVoices: webSpeechTTS.getVoices().length,
      recommendedSettings: {
        lang: 'ko-KR',
        rate: 0.9, // 조금 느리게 (환자 이해 용이)
        pitch: 1,
        volume: 1
      }
    };
  }
};

export {
  webSpeechTTS,
  googleCloudTTS
};

export default textToSpeech;
