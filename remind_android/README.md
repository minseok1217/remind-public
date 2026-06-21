# REMIND Android 앱

`remind_android/`는 REMIND 웹 서비스를 Android에서 안정적으로 사용할 수 있게 하는 WebView 기반 래퍼 앱입니다. 핵심 화면과 비즈니스 로직은 Firebase Hosting에 배포된 `remind_web`이 담당하고, Android 앱은 웹만으로 처리하기 어려운 네이티브 기능을 브리지로 제공합니다.

## 기술 스택

- Kotlin
- Android Gradle Plugin 8.13.2
- compileSdk / targetSdk 36, minSdk 27
- AndroidX AppCompat, Material Components
- Firebase Auth, Firestore, Messaging
- Android WebView, AlarmManager, SpeechRecognizer

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `app/src/main/java/com/example/remind_webapp/ui/SplashActivity.kt` | 앱 시작 화면입니다. 알림/마이크 권한과 배터리 최적화 예외를 요청한 뒤 `MainActivity`로 이동합니다. |
| `app/src/main/java/com/example/remind_webapp/ui/MainActivity.kt` | WebView를 초기화하고 `https://remind-aa99f.web.app`을 로드합니다. Android-Web 브리지와 네이티브 음성 인식을 등록합니다. |
| `app/src/main/java/com/example/remind_webapp/web/WebViewManager.kt` | WebView 설정, 콘솔 로그 전달, 파일 선택기, 권한 요청 처리를 담당합니다. |
| `app/src/main/java/com/example/remind_webapp/web/WebViewClientImpl.kt` | WebView URL 이동 허용 여부를 `UrlPolicy`로 판단합니다. |
| `app/src/main/java/com/example/remind_webapp/util/UrlPolicy.kt` | WebView에서 허용할 URL 정책을 정의합니다. |
| `app/src/main/java/com/example/remind_webapp/util/AlramHelper.kt` | `AlarmManager.setExactAndAllowWhileIdle` 기반 알람 예약 유틸입니다. 파일명은 `AlramHelper.kt`이지만 객체명은 `AlarmHelper`입니다. |
| `app/src/main/java/com/example/remind_webapp/alarm/AlarmReceiver.kt` | 예약 알람을 수신해 전체 화면 알람 Activity와 알림을 띄우고 다음 알람을 다시 예약합니다. |
| `app/src/main/java/com/example/remind_webapp/ui/AlarmActivity.kt` | 잠금 화면 위에 표시되는 통화 수락/거절 화면입니다. 수락 시 통화 화면으로 진입합니다. |
| `app/src/main/java/com/example/remind_webapp/alarm/TimeMessagingService.kt` | FCM 데이터 메시지의 `time` 값을 받아 알람 시간 설정 알림을 표시합니다. |
| `app/src/main/java/com/example/remind_webapp/RemindApplication.kt` | Firebase 초기화와 알람 Notification Channel 생성을 수행합니다. |

## 앱 시작 흐름

1. `SplashActivity`가 런처 Activity로 실행됩니다.
2. Android 13 이상에서는 `POST_NOTIFICATIONS`, 모든 버전에서는 `RECORD_AUDIO` 권한을 확인합니다.
3. 배터리 최적화 예외를 요청합니다.
4. `MainActivity`가 실행되고 WebView가 초기화됩니다.
5. WebView가 `https://remind-aa99f.web.app`을 로드합니다.
6. 환자 홈 화면에서 `window.AndroidBridge.onReady()`를 호출하면 Android가 FCM 토큰을 웹으로 전달합니다.

## Web Bridge

`MainActivity`는 WebView에 두 개의 JavaScript 인터페이스를 등록합니다.

```kotlin
webView.addJavascriptInterface(WebAppBridge(), "AndroidBridge")
webView.addJavascriptInterface(AndroidSpeechBridge(), "AndroidSpeechBridge")
```

### AndroidBridge

| Web 호출 | Android 동작 |
| --- | --- |
| `window.AndroidBridge.onReady()` | Firebase Messaging 토큰을 가져와 `window.onReceiveFcmToken(token)`으로 웹에 전달합니다. 알람으로 앱이 열린 경우 통화 화면 진입도 처리합니다. |
| `window.AndroidBridge.setAlarmTimeOnce("HH:mm")` | 전달받은 시간을 파싱해 정확한 알람을 예약합니다. Android 12 이상에서는 정확한 알람 권한을 확인합니다. |

### AndroidSpeechBridge

| Web 호출 또는 콜백 | 역할 |
| --- | --- |
| `window.AndroidSpeechBridge.startListening()` | Android `SpeechRecognizer`를 `ko-KR`로 시작합니다. |
| `window.AndroidSpeechBridge.stopListening()` | 진행 중인 음성 인식을 중단하고 리소스를 해제합니다. |
| `window.__androidSpeechOnTranscript(text)` | 중간 인식 결과를 웹에 전달합니다. |
| `window.__androidSpeechOnResult(text)` | 최종 인식 결과를 웹에 전달합니다. |
| `window.__androidSpeechOnNoResult()` | 인식 결과가 없을 때 웹에 알립니다. |
| `window.__androidSpeechOnError(code, label)` | Android SpeechRecognizer 오류 코드를 웹에 전달합니다. |

웹에서는 `remind_web/src/hooks/useScribeSpeechRecognition.js`가 `AndroidSpeechBridge` 존재 여부를 먼저 확인합니다. Android 브리지가 있으면 네이티브 음성 인식을 우선 사용하고, 없으면 ElevenLabs Scribe 또는 Web Speech API로 폴백합니다.

## 알람 흐름

1. 웹 환자 홈 화면에서 통화 시간을 저장합니다.
2. 웹이 `window.AndroidBridge.setAlarmTimeOnce("HH:mm")`를 호출합니다.
3. Android가 `AlarmHelper.scheduleAlarm()`으로 `AlarmReceiver`를 예약합니다.
4. 알람 시간이 되면 `AlarmReceiver`가 `AlarmActivity`를 전체 화면으로 띄우고 알림을 표시합니다.
5. 사용자가 수락하면 `SplashActivity`에 `START_PAGE=VoiceChatScreen`을 전달합니다.
6. `MainActivity.openStartPage()`가 웹의 `window.openVoiceChatScreenPage()`를 호출해 통화 화면으로 이동합니다.
7. `AlarmReceiver`는 저장된 `alarm_time`을 기반으로 다음 알람도 다시 예약합니다.

## FCM 흐름

- Android는 `FirebaseMessaging.getInstance().token`으로 현재 기기의 FCM 토큰을 가져옵니다.
- 웹 환자 홈 화면의 `window.onReceiveFcmToken(token)`이 이 토큰을 받아 Firestore에 저장합니다.
- 보호자가 환자 통화 시간을 변경하면 웹은 저장된 토큰으로 `pushSend` Cloud Function을 호출합니다.
- Android의 `TimeMessagingService`는 FCM 데이터의 `time` 값을 받아 알람 시간 설정 알림을 띄웁니다.

## 빌드와 실행

Android Studio에서 `remind_android/`를 열어 실행하거나 PowerShell에서 다음 명령을 사용합니다.

```powershell
cd .\remind_android
.\gradlew.bat assembleDebug
```

주요 설정 파일은 다음과 같습니다.

- `settings.gradle.kts`: 루트 프로젝트명은 `remind_webapp`, 모듈은 `:app`입니다.
- `app/build.gradle.kts`: 애플리케이션 ID는 `com.example.remind_webapp`입니다.
- `app/google-services.json`: Firebase Android 앱 설정입니다.
- `gradle/libs.versions.toml`: AndroidX, Firebase Messaging, Kotlin, AGP 버전을 관리합니다.

## 권한

`AndroidManifest.xml`에는 다음 권한이 선언되어 있습니다.

- `POST_NOTIFICATIONS`
- `RECORD_AUDIO`
- `SCHEDULE_EXACT_ALARM`
- `USE_FULL_SCREEN_INTENT`
- `WAKE_LOCK`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
- `READ_MEDIA_*`, `READ_EXTERNAL_STORAGE`
- `MODIFY_AUDIO_SETTINGS`

## 개발 참고

- `MainActivity`의 WebView 시작 URL은 현재 `https://remind-aa99f.web.app`으로 고정되어 있습니다.
- `UrlPolicy.kt`의 `BASE_URL`은 현재 테스트 URL로 되어 있어 운영 도메인과 맞지 않습니다. WebView 내 링크 이동 정책을 사용할 예정이라면 `https://remind-aa99f.web.app` 기준으로 수정해야 합니다.
- WebView 파일 업로드는 `WebViewManager.onShowFileChooser()`에서 처리합니다. Activity 결과 전달이 필요한 경우 `MainActivity.onActivityResult()`와 `WebViewManager.handleFileChooserResult()`의 request code 흐름을 함께 확인해야 합니다.
- 사용자 노출 문자열 일부가 깨져 있습니다. 알림 제목, 버튼 텍스트, 리소스 문자열은 UTF-8로 정리하는 것이 좋습니다.
