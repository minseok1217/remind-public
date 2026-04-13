# 텍스트-음성 변환 (TTS) 설정 가이드

## 개요

이 프로젝트에는 두 가지 TTS (Text-to-Speech) 방식이 지원됩니다:

1. **Web Speech API** (기본, 무료) - 브라우저에 내장된 음성 합성 기능
2. **Google Cloud Text-to-Speech API** (고급, 유료) - 더 자연스러운 음성 품질

---

## 방법 1: Web Speech API (기본 설정, 무료)

### 장점
- ✅ 무료
- ✅ 브라우저에 내장되어 있음
- ✅ 별도 설정 불필요
- ✅ 인터넷 연결 불필요 (오프라인 작동)

### 단점
- ❌ 음성 품질이 낮음
- ❌ 언어별 음성 선택 제한적
- ❌ 브라우저마다 음성이 다를 수 있음

### 사용 방법

자동으로 활성화됩니다. 별도의 설정이 필요하지 않습니다.

```javascript
import { textToSpeech } from './services/textToSpeechService';

// 텍스트를 음성으로 재생
await textToSpeech.speak('안녕하세요', {
  lang: 'ko-KR',
  rate: 0.9,
  pitch: 1,
  onEnd: () => console.log('음성 재생 완료')
});
```

---

## 방법 2: Google Cloud Text-to-Speech API (고급, 유료)

### 장점
- ✅ 매우 자연스러운 음성 품질
- ✅ 다양한 음성 옵션
- ✅ 더 많은 언어 지원
- ✅ 일관된 음성 품질

### 단점
- ❌ 유료 (월 약 $4~15)
- ❌ 인터넷 연결 필요
- ❌ API 키 설정 필요

### 비용 계산

Google Cloud Text-to-Speech 비가격:
- **$4/백만 자**: 가장 저렴한 표준 음성
- **$16/백만 자**: Neural2 음성 (가장 자연스러움)

예: 하루 10명 환자 × 3분 통화 × 약 5000자 = 50,000자/일
월 비용 = 50,000 × 30 ÷ 1,000,000 × $4 = $6

### 설정 방법

#### Step 1: Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)로 이동
2. 새 프로젝트 생성
3. "Text-to-Speech API" 검색 후 활성화
4. "서비스 계정" 생성
5. JSON 키 다운로드

#### Step 2: 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```env
REACT_APP_GOOGLE_TTS_API_KEY=YOUR_API_KEY_HERE
```

#### Step 3: 코드에서 사용

```javascript
import { textToSpeech } from './services/textToSpeechService';

// Google Cloud TTS 사용 (자동으로 API 키가 있으면 사용됨)
await textToSpeech.speak('안녕하세요', {
  method: 'google',  // 'google' 또는 'web'
  lang: 'ko-KR',
  rate: 1,
  pitch: 0
});
```

---

## API 키 설정 방법

### 방법 1: 환경 변수 (.env.local 파일)

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# remind_web/.env.local
REACT_APP_GOOGLE_TTS_API_KEY=AIzaSyD...xxxxxxxxxxxxx
```

> **주의**: `.env.local` 파일은 `.gitignore`에 추가되어야 합니다 (보안)

### 방법 2: React 앱 시작 시 설정

```javascript
// App.jsx나 main.jsx
if (process.env.REACT_APP_GOOGLE_TTS_API_KEY) {
  console.log('✅ Google Cloud TTS API 키가 설정되었습니다');
} else {
  console.warn('⚠️ Google Cloud TTS API 키가 없습니다. Web Speech API를 사용합니다.');
}
```

### 방법 3: 런타임 설정 (프런트엔드 설정 페이지)

나중에 관리자가 앱 내에서 API 키를 설정할 수 있도록 구현 가능.

---

## 현재 구현 상태

### KMMSEScreen에서의 사용

- ✅ 도입 나레이션에 "🔊 나레이션 듣기" 버튼 추가
- ✅ 섹션 전환 나레이션에 음성 지원
- ✅ 음성 재생 중 버튼 비활성화 표시

### VoiceChatScreen에서의 사용 (향후 구현)

```javascript
// 통화 시작 시 인사 음성
await textToSpeech.speak('안녕하세요, 만나서 반갑습니다!', {
  lang: 'ko-KR',
  rate: 0.9
});
```

---

## 음성 설정 옵션

### 언어 코드
- `ko-KR`: 한국어
- `en-US`: 영어
- `ja-JP`: 일본어
- `zh-CN`: 중국어 (간체)

### 재생 속도 (rate)
- `0.1 ~ 10` (기본: 1)
- 0.9 권장 (조금 느리게, 노인 사용자 배려)

### 음정 (pitch)
- `0 ~ 2` (기본: 1)
- 1.2 추천 (조금 높게, 친근한 느낌)

### 볼륨 (volume)
- `0 ~ 1` (기본: 1)
- 1 권장 (최대 볼륨)

---

## 사용 예시

### 기본 사용

```javascript
import { textToSpeech } from './services/textToSpeechService';

// 간단한 사용
await textToSpeech.speak('환자님, 안녕하세요');
```

### 설정과 함께 사용

```javascript
await textToSpeech.speak('이 버튼을 눌러주세요', {
  lang: 'ko-KR',
  rate: 0.8,
  pitch: 1.2,
  volume: 1,
  onStart: () => console.log('재생 시작'),
  onEnd: () => console.log('재생 완료'),
  onError: (error) => console.error('오류:', error)
});
```

### 음성 중지

```javascript
textToSpeech.stop();
```

### 현재 상태 확인

```javascript
if (textToSpeech.isSpeaking()) {
  console.log('현재 음성 재생 중');
}
```

---

## 문제 해결

### 음성이 안 나옴

1. **브라우저 확인**: 최신 Chrome, Firefox, Safari 사용
2. **음량 확인**: 시스템 볼륨 확인
3. **권한 확인**: 마이크/스피커 권한 확인 (권한 요청 팝업)
4. **콘솔 확인**: 브라우저 개발자 도구 (F12) → Console 탭에서 오류 확인

### Google Cloud TTS가 작동하지 않음

1. **API 키 확인**: `.env.local`에 올바른 키가 설정되었는지 확인
2. **API 활성화 확인**: Google Cloud Console에서 API가 활성화되었는지 확인
3. **쿼터 확인**: Google Cloud Console에서 사용 쿼터를 초과했는지 확인
4. **인터넷 연결 확인**: 인터넷 연결 상태 확인

### 음성 품질이 낮음

1. **Web Speech API 사용 중이라면**: Google Cloud TTS API 키 설정 후 사용
2. **음성 선택**: Google Cloud TTS에서 `Neural2` 음성 사용
3. **속도 조정**: `rate: 0.9` 권장

---

## 추가 설정 (선택사항)

### Google Cloud의 다양한 음성 옵션

```javascript
// 한국어 Neural2 음성 (가장 자연스러움)
await textToSpeech.speak('안녕하세요', {
  method: 'google',
  lang: 'ko-KR',
  voiceName: 'ko-KR-Neural2-A',  // or 'ko-KR-Neural2-C'
  rate: 1,
  pitch: 0
});
```

### 비용 절감 팁

1. **Web Speech API 기본 사용**: 필요할 때만 Google Cloud 사용
2. **음성 캐싱**: 자주 사용하는 텍스트는 미리 음성 합성 후 저장
3. **배치 처리**: 비즈니스 시간 외에 대량 합성

---

## 참고 자료

- [Web Speech API - MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Google Cloud Text-to-Speech - 공식 문서](https://cloud.google.com/text-to-speech/docs)
- [한국어 NLP 리소스](https://github.com/haven-jeon/korean_spell_checker)

---

## 문의

API 설정에 문제가 있으면 관리자에게 문의하세요.
