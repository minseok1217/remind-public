# REMIND Web 서비스

`remind_web/`는 REMIND의 핵심 웹 애플리케이션입니다. React + Vite로 구현되어 있으며 Firebase Auth, Firestore, Storage, Hosting, Functions를 사용합니다. Android 앱은 이 웹 앱을 WebView로 로드하고, 네이티브 기능은 JavaScript Bridge로 보강합니다.

## 기술 스택

- React 19
- Vite 7
- Firebase 12
- Firebase Hosting, Firestore, Storage, Auth, Cloud Functions
- Gemini API
- ElevenLabs TTS/STT
- Web Speech API fallback

## 실행

```powershell
cd .\remind_web
npm install
npm run dev
```

빌드:

```powershell
npm run build
```

미리보기:

```powershell
npm run preview
```

정적 검사:

```powershell
npm run lint
```

## 환경 변수

로컬 개발 시 `remind_web/.env.local`을 사용합니다.

```env
VITE_GEMINI_API_KEY=
VITE_GEMINI_PROXY=/api/gemini/analyze
VITE_FIREBASE_VAPID_KEY=
VITE_ELEVENLABS_API_KEY=
VITE_ELEVENLABS_SCRIBE_TOKEN_ENDPOINT=/api/elevenlabs/scribe-token
```

| 변수 | 용도 |
| --- | --- |
| `VITE_GEMINI_API_KEY` | Cloud Function 프록시가 실패하거나 없는 경우 클라이언트에서 Gemini를 직접 호출할 때 사용합니다. |
| `VITE_GEMINI_PROXY` | 이미지 분석 기본 프록시입니다. 기본값은 `/api/gemini/analyze`입니다. |
| `VITE_FIREBASE_VAPID_KEY` | 웹 푸시 토큰 발급에 필요합니다. |
| `VITE_ELEVENLABS_API_KEY` | 브라우저에서 ElevenLabs TTS를 직접 호출할 때 사용합니다. 없으면 Web Speech API로 폴백합니다. |
| `VITE_ELEVENLABS_SCRIBE_TOKEN_ENDPOINT` | ElevenLabs Scribe 실시간 STT 토큰을 발급받는 endpoint입니다. 기본값은 `/api/elevenlabs/scribe-token`입니다. |

Cloud Functions는 Firebase Secret으로 `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`를 사용합니다.

```powershell
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
```

## 폴더 구조

| 경로 | 역할 |
| --- | --- |
| `src/App.jsx` | 로그인 상태, 역할, 주요 화면 전환, Android에서 호출하는 전역 화면 이동 함수를 관리합니다. |
| `src/main.jsx` | React 앱 진입점입니다. |
| `src/firebase.js` | Firebase 앱, Auth, Firestore, Storage 초기화입니다. |
| `src/components/` | 화면 단위 컴포넌트입니다. 로그인, 메인, 사진 등록, 통계, 통화, K-MMSE, 지남력 훈련이 들어 있습니다. |
| `src/services/` | Gemini, TTS, 알림, 가족 연결, 대화 분석 등 도메인 서비스입니다. |
| `src/hooks/useScribeSpeechRecognition.js` | Android 네이티브 음성 인식, ElevenLabs Scribe, Web Speech API를 하나의 STT 인터페이스로 묶습니다. |
| `functions/index.js` | Firebase Cloud Functions API입니다. Gemini 프록시와 ElevenLabs Scribe 토큰 endpoint를 제공합니다. |
| `public/firebase-messaging-sw.js` | 웹 푸시 백그라운드 메시지와 알림 클릭 처리를 담당합니다. |
| `public/tts/` | 통화 전 사전 생성 TTS mp3 파일입니다. |

## 화면 구성

`App.jsx`는 React Router 대신 상태 기반으로 화면을 전환합니다.

| 화면 | 컴포넌트 | 설명 |
| --- | --- | --- |
| 로그인/회원가입 | `LoginScreen`, `SignupScreen`, `FindIdScreen`, `FindPasswordScreen` | Firebase Auth 기반 계정 흐름입니다. |
| 보호자 홈 | `MainScreen` | 보호자 대시보드, 환자 연결, 최근 통화 정보 진입점입니다. |
| 환자 홈 | `MainScreen_p` | 환자 통화 시간, 알림, 보호자 연결 코드, Android Bridge 연동을 담당합니다. |
| 사진 등록/관리 | `PhotoScreen`, `PhotoManagementScreen` | 회상 통화용 사진 업로드, AI 질문/캡션 생성, 사진 관리 기능입니다. |
| 통계/기록 | `StatsScreen`, `CallHistoryScreen`, `CallDetailScreen` | 통화 이력, 분석 결과, 상세 내용을 보여줍니다. |
| 통화 | `OrientationTrainingScreen`, `VoiceChatScreen` | 지남력 훈련 후 사진 기반 AI 음성 통화를 진행합니다. |
| K-MMSE | `KMMSEScreen` | 환자 인지검사와 난이도 산정을 수행합니다. |
| 프로필 | `ProfileScreen` | 보호자/환자 정보 수정, 환자 추가, 통화 시간 변경과 푸시 발송을 처리합니다. |

## Android Bridge 연동

Android 앱은 `remind_web`을 WebView로 띄우고 아래 전역 함수를 사용합니다.

| 위치 | 함수 | 설명 |
| --- | --- | --- |
| `MainScreen_p.jsx` | `window.AndroidBridge.onReady()` | Android에 웹 준비 완료를 알립니다. Android는 FCM 토큰을 가져와 웹 콜백을 호출합니다. |
| `MainScreen_p.jsx` | `window.onReceiveFcmToken(token)` | Android에서 받은 FCM 토큰을 Firestore에 저장합니다. |
| `MainScreen_p.jsx` | `window.AndroidBridge.setAlarmTimeOnce(selectedCallTime)` | 환자가 통화 시간을 변경하면 Android 정확한 알람을 설정합니다. |
| `App.jsx` | `window.openVoiceChatScreenPage()` | Android 알람 수락 후 통화 화면으로 이동합니다. |
| `App.jsx` | `window.openOrientationTrainingScreenPage()` | Android에서 지남력 훈련 화면으로 이동할 때 사용합니다. |
| `App.jsx` | `window.openKMMSEScreenPage()` | Android 디버그 버튼 등에서 K-MMSE 화면을 열 때 사용합니다. |
| `useScribeSpeechRecognition.js` | `window.AndroidSpeechBridge.startListening()` | Android 네이티브 음성 인식을 시작합니다. |

웹은 Android 환경이 아니어도 동작하도록 작성되어 있습니다. `AndroidBridge` 또는 `AndroidSpeechBridge`가 없으면 웹 푸시, ElevenLabs Scribe, Web Speech API, Web Speech TTS로 폴백합니다.

## AI, TTS, STT 흐름

### Gemini

`src/services/geminiService.js`가 Gemini 호출을 담당합니다.

- 사진 분석: `analyzeImageWithGemini`
- 사진 후속 질문: `generateFollowUpQuestions`
- 최종 캡션: `generateFinalCaption`
- 통화 대화: `chatWithGemini`
- 통화 리포트: `evaluateConversationReport`
- 통화 인사이트: `generateCallInsightLines`
- 지남력 평가/힌트: `evaluateAnswerWithGemini`, `generateOrientationHint`

`functions/index.js`는 다음 API를 제공합니다.

| Endpoint | 용도 |
| --- | --- |
| `GET /api/elevenlabs/scribe-token` | ElevenLabs Scribe 단회용 토큰 발급 |
| `POST /api/gemini/caption` | 텍스트 프롬프트 기반 Gemini 호출 |
| `POST /api/gemini/evaluate` | 지남력/K-MMSE 답변 평가 |
| `POST /api/gemini/hint` | 지남력 힌트 생성 |
| `POST /api/gemini/chat` | 회상 통화 대화 |
| `POST /api/gemini/analyze` | 이미지 기반 사진 분석 |

### TTS

`src/services/ttsService.js`는 ElevenLabs TTS를 우선 사용하고 실패하거나 키가 없으면 Web Speech API로 폴백합니다. `VoiceChatScreen`은 TTS 큐를 관리하며, `public/tts/precall_condition_ko.mp3` 같은 사전 생성 음성 파일을 먼저 재생할 수 있습니다.

### STT

`src/hooks/useScribeSpeechRecognition.js`는 다음 순서로 음성 인식을 선택합니다.

1. Android WebView에서 `window.AndroidSpeechBridge`가 있으면 Android `SpeechRecognizer` 사용
2. ElevenLabs Scribe 실시간 STT 사용
3. Web Speech API 사용

## 주요 데이터 모델

| 경로 | 설명 |
| --- | --- |
| `users/{uid}` | 사용자 공통 정보와 역할 |
| `guardians/{uid}` | 보호자 상세 정보 |
| `patients/{uid}` | 환자 정보, 통화 시간, K-MMSE 결과, 알림 설정 |
| `patients/{uid}/notification_tokens/{tokenHash}` | Android/Web 푸시 토큰 |
| `family_links/{guardianId}_{patientId}` | 보호자-환자 연결 |
| `temp_codes/{code}` | 기존 환자 연결용 임시 코드 |
| `users/{patientId}/photos/{photoId}` | 사진 URL, 설명, 질문, 키워드, 통화 사용 상태 |
| `call_logs/{logId}` | 통화 대화, 분석 결과, 점수, 인사이트 |
| `orientation_images/{docId}` | 사진이 없을 때 쓰는 대체 이미지 |

## 알림 흐름

### 웹 푸시

1. 환자 홈에서 알림을 켜면 `registerWebPushToken()`이 서비스 워커를 등록합니다.
2. Firebase Messaging 토큰을 발급받아 `patients/{uid}/notification_tokens`에 저장합니다.
3. `public/firebase-messaging-sw.js`가 백그라운드 알림을 표시합니다.
4. 알림 클릭 시 기존 탭에는 `postMessage({ type: 'NOTIFICATION_CLICK', action: 'open_voicechat' })`를 보내고, 탭이 없으면 `/?open=voicechat`로 새 탭을 엽니다.
5. `App.jsx`가 해당 신호를 받아 환자 계정이면 통화 화면으로 이동합니다.

### Android 푸시

1. Android 앱이 `AndroidBridge.onReady()` 처리 중 FCM 토큰을 웹으로 전달합니다.
2. 웹은 토큰을 `platform: "android"`로 저장합니다.
3. 보호자가 통화 시간을 변경하면 `sendPushNotificationToTokens()`가 `pushSend` Cloud Function URL로 요청합니다.
4. Android `TimeMessagingService`는 FCM 데이터의 `time`을 받아 알림을 띄우고, 사용자가 누르면 `TimeSettingActivity`에서 로컬 알람을 설정합니다.

현재 `src/services/notificationService.js`와 `ProfileScreen.jsx`는 `https://us-central1-remind-aa99f.cloudfunctions.net/pushSend`를 호출합니다. 이 함수는 현재 `functions/index.js`의 `api` 함수와 별도로 운영되는 것으로 보이므로 배포 상태를 확인해야 합니다.

## 사진 등록 흐름

1. 보호자가 `PhotoScreen`에서 사진을 선택합니다.
2. 앱은 먼저 Firebase Storage SDK 업로드를 시도합니다.
3. SDK 업로드 실패 시 Firebase Storage REST API로 재시도합니다.
4. REST 업로드도 실패하면 Canvas로 압축한 data URL을 Firestore에 직접 저장합니다.
5. Firestore `users/{patientId}/photos` 문서에 초안이 생성됩니다.
6. Gemini가 후속 질문, 캡션, 키워드, 대화 스타터를 보강합니다.

## 통화 흐름

1. 환자가 통화 화면으로 들어오면 당일 지남력 훈련 완료 여부를 확인합니다.
2. 지남력 훈련을 마치면 `localStorage`에 완료 날짜를 저장하고 `VoiceChatScreen`으로 이동합니다.
3. 통화 화면은 환자 사진 중 아직 사용하지 않은 사진을 우선 선택합니다.
4. 사진이 없으면 `orientation_images`에서 대체 이미지를 사용하거나 사진 없는 대화를 시작합니다.
5. Gemini가 질문을 생성하고 TTS가 읽어줍니다.
6. 사용자의 답변은 Android SpeechRecognizer, ElevenLabs Scribe, Web Speech API 중 가능한 STT로 인식됩니다.
7. 종료 시 `call_logs`에 대화, 분석, 점수, 인사이트를 저장하고 사용한 사진은 `통화후` 상태로 업데이트합니다.

## 배포

Firebase Hosting과 Functions 설정은 `firebase.json`에 있습니다.

- Hosting public directory: `dist`
- `/api/**` rewrite: `api` Cloud Function, region `asia-northeast3`
- SPA fallback: `/index.html`
- Functions source: `functions/`
- Functions Node runtime: `24`

일반 배포 흐름:

```powershell
cd .\remind_web
npm install
npm run build
firebase deploy
```

Functions만 배포:

```powershell
cd .\remind_web
firebase deploy --only functions
```

Firestore rules만 배포:

```powershell
cd .\remind_web
firebase deploy --only firestore:rules
```

## 개발 참고

- `public/index.html`은 Firebase Hosting 기본 샘플 파일이 남아 있지만 Vite 앱 빌드는 루트 `index.html`을 사용합니다.
- 일부 파일에 깨진 한글 문자열이 보입니다. 사용자에게 보이는 텍스트와 문서는 UTF-8 기준으로 정리하는 것이 좋습니다.
- `TTS_SETUP_GUIDE.md`도 한글이 깨져 있으므로 TTS 문서를 갱신할 때 함께 정리하는 것이 좋습니다.
- Android 연동을 바꾸는 경우 `MainScreen_p.jsx`, `App.jsx`, `useScribeSpeechRecognition.js`, Android `MainActivity.kt`를 함께 확인해야 합니다.
