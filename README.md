 # REMIND 프로젝트 안내

REMIND는 보호자와 환자 계정을 연결해 추억 사진 기반 AI 통화, 지남력 훈련, K-MMSE 검사, 통화 기록 분석을 제공하는 서비스입니다. 저장소의 현재 운영 축은 웹 서비스인 `remind_web/`와 Android 지원 앱인 `remind_android/`입니다.

## 폴더 구성

| 경로 | 역할 |
| --- | --- |
| `remind_web/` | React + Vite 기반 웹 앱입니다. Firebase Auth, Firestore, Storage, Hosting, Functions를 사용하고 Gemini, ElevenLabs TTS/STT, Web Speech API를 연동합니다. |
| `remind_android/` | Android WebView 래퍼 앱입니다. Firebase Hosting에 배포된 웹 앱을 로드하고, 네이티브 알람, FCM, 음성 인식, 파일 선택을 Web Bridge로 지원합니다. |
| `src/`, `app/`, `server/` 등 루트의 다른 폴더 | 과거 또는 별도 실험용 코드로 보이며, 현재 서비스 설명과 실행 기준은 `remind_web/`, `remind_android/`를 우선합니다. |

## 전체 동작 흐름

1. 사용자는 `remind_web` 웹 앱에서 보호자 또는 환자로 로그인합니다.
2. 보호자는 환자 계정을 생성하거나 기존 환자와 연결하고, 환자 정보와 통화 시간을 관리합니다.
3. 보호자는 사진을 등록합니다. 사진은 Firebase Storage에 업로드되고, 메타데이터는 `users/{patientId}/photos`에 저장됩니다.
4. 환자는 Android 앱 또는 웹에서 통화 화면에 진입합니다.
5. 통화 전 지남력 훈련을 완료하면 `VoiceChatScreen`이 Gemini, TTS, STT를 사용해 사진 기반 회상 대화를 진행합니다.
6. 통화 종료 후 대화 내용, 분석 결과, 인지 점수, 사용 사진 정보가 `call_logs`에 저장됩니다.
7. Android 앱은 WebView 안의 웹 앱을 실행하면서 네이티브 알람, 푸시 토큰, 음성 인식을 브리지로 보강합니다.

## Web - Android Bridge 요약

| 방향 | API | 역할 |
| --- | --- | --- |
| Web -> Android | `window.AndroidBridge.onReady()` | 환자 홈 화면이 Android 준비를 알립니다. Android는 FCM 토큰을 가져와 웹으로 전달하고, 알림으로 열린 시작 화면이 있으면 처리합니다. |
| Android -> Web | `window.onReceiveFcmToken(token)` | Android FCM 토큰을 웹에 전달합니다. 웹은 `patients/{uid}.fcmToken`과 `patients/{uid}/notification_tokens/{hash}`에 저장합니다. |
| Web -> Android | `window.AndroidBridge.setAlarmTimeOnce("HH:mm")` | 환자 통화 시간이 바뀌면 Android의 정확한 알람을 설정합니다. |
| Web -> Android | `window.AndroidSpeechBridge.startListening()` / `stopListening()` | 웹 STT 훅이 Android 네이티브 음성 인식을 호출합니다. |
| Android -> Web | `window.__androidSpeechOnTranscript(text)` | Android 음성 인식 중간 결과를 웹에 전달합니다. |
| Android -> Web | `window.__androidSpeechOnResult(text)` | Android 음성 인식 최종 결과를 웹에 전달합니다. |
| Android -> Web | `window.__androidSpeechOnNoResult()` / `window.__androidSpeechOnError(code, label)` | 음성 결과 없음 또는 오류를 웹에 전달합니다. |
| Android -> Web | `window.openVoiceChatScreenPage()` | 알람 수락 후 웹 앱을 통화 화면으로 이동시킵니다. |

## 주요 Firebase 데이터

| 컬렉션 | 용도 |
| --- | --- |
| `users` | 공통 사용자 프로필과 역할 정보 |
| `guardians` | 보호자 상세 정보 |
| `patients` | 환자 상세 정보, 통화 시간, 알림 설정, K-MMSE 결과, 난이도 |
| `patients/{patientId}/notification_tokens` | Android/Web 푸시 토큰 저장소 |
| `family_links` | 보호자-환자 연결 상태 |
| `temp_codes` | 기존 환자 연결을 위한 임시 코드 |
| `users/{patientId}/photos` | 회상 통화용 사진과 분석 메타데이터 |
| `call_logs` | AI 통화 기록과 분석 결과 |
| `orientation_images` | 사진이 없을 때 사용할 지남력/대체 이미지 데이터 |

## 로컬 실행

### 웹

```powershell
cd .\remind_web
npm install
npm run dev
```

빌드는 다음 명령을 사용합니다.

```powershell
npm run build
```

### Android

Android Studio에서 `remind_android/`를 프로젝트로 열거나 다음 명령으로 디버그 빌드를 만들 수 있습니다.

```powershell
cd .\remind_android
.\gradlew.bat assembleDebug
```

Android 앱은 현재 `https://remind-aa99f.web.app`을 WebView로 로드합니다.

## 환경 변수와 비밀값

웹 앱의 `.env.local`에서 주로 사용하는 값은 다음과 같습니다.

```env
VITE_GEMINI_API_KEY=
VITE_GEMINI_PROXY=/api/gemini/analyze
VITE_FIREBASE_VAPID_KEY=
VITE_ELEVENLABS_API_KEY=
VITE_ELEVENLABS_SCRIBE_TOKEN_ENDPOINT=/api/elevenlabs/scribe-token
```

Firebase Functions는 `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` 시크릿을 사용합니다.

```powershell
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
```

## 운영 참고

- `remind_web/firebase.json`은 `/api/**` 요청을 `asia-northeast3` 리전의 `api` Cloud Function으로 rewrite합니다.
- `notificationService.js`와 `ProfileScreen.jsx`는 `https://us-central1-remind-aa99f.cloudfunctions.net/pushSend`를 호출합니다. 현재 `remind_web/functions/index.js`에는 `api` 함수만 보이므로, `pushSend`는 별도 배포 함수인지 확인이 필요합니다.
- Android의 `UrlPolicy.kt`에는 테스트 URL이 남아 있습니다. WebView 이동 정책을 운영 도메인인 `https://remind-aa99f.web.app` 기준으로 점검해야 합니다.
- 일부 Kotlin/문서 문자열에 깨진 한글이 보입니다. 실행 로직과 별개로 사용자에게 노출되는 문자열은 UTF-8 기준으로 정리하는 것이 좋습니다.

