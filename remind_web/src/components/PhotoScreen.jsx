import { useState, useRef } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { generateFollowUpQuestions, generateFinalCaption, extractKeywordsFromPhoto, extractAnswerKeywords } from '../services/geminiService';
import { getConnectedPatientId } from '../services/familyLinkService';
import './PhotoScreen.css';
import upload_icon from '../assets/photo_icon_on.png';

const YEAR_OPTIONS = [
  '1960년대 이전', '1960~1970', '1970~1980', '1980~1990',
  '1990~2000', '2000~2010', '2010~2020', '2020년 이후', '직접 입력',
];
const PEOPLE_OPTIONS = ['배우자', '자녀', '손자/손녀', '친구', '혼자', '기타'];
const LOCATION_OPTIONS = ['집', '산', '바다', '공원', '해외', '기타'];

// 단계 표시기용
const STEP_LABELS = ['사진 선택', '정보 입력', 'AI 질문', '완료'];
const STEP_IDX = { upload: 0, step1: 1, confirm_ai: 2, step2: 2, complete: 3 };

const createCaptionCategory = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  category: '',
  value: '',
});

const normalizeCaptionCategories = (items = []) =>
  items
    .map((item) => ({
      category: String(item.category || '').trim(),
      value: String(item.value || '').trim(),
    }))
    .filter((item) => item.category && item.value);

const buildAnswerKeywordsFromCategories = (items = []) =>
  normalizeCaptionCategories(items).map((item) => ({
    category: item.category,
    value: item.value,
  }));

function PhotoScreen({ currentUser, onBack, onGoToManagement }) {
  // ── 단계 ──
  const [step, setStep] = useState('upload');

  // ── 사진 ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [photoDocId, setPhotoDocId] = useState(null);
  const docIdPromiseRef = useRef(null); // 백그라운드 업로드 promise

  // ── 묶음 업로드 ──
  const [batchFiles, setBatchFiles] = useState([]); // [{file, previewURL}]
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchDone, setBatchDone] = useState(false);

  // ── Step 1 ──
  const [year, setYear] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [people, setPeople] = useState([]);
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [freeText, setFreeText] = useState('');
  const [captionCategories, setCaptionCategories] = useState([createCaptionCategory()]);

  // ── Step 2 ──
  const [savedStep1, setSavedStep1] = useState(null);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [aiAnswers, setAiAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isLoadingQ, setIsLoadingQ] = useState(false);

  // 업로드와 동시에 백그라운드에서 생성된 AI 질문 (null = 아직 미완료)
  const [prefetchedQuestions, setPrefetchedQuestions] = useState(null);
  const questionPromiseRef = useRef(null);
  const questionRequestIdRef = useRef(0);

  // ── 완료 ──
  const [finalCaption, setFinalCaption] = useState('');

  // ─────────────────────────────────────
  // 헬퍼
  // ─────────────────────────────────────

  const buildStep1Data = () => ({
    year: year === '직접 입력' ? customYear : year,
    people: [...people],
    location: location === '기타' ? customLocation : location,
    freeText: freeText.trim(),
    captionCategories: normalizeCaptionCategories(captionCategories),
  });

  const buildSimpleCaption = (s1) => {
    if (!s1) return '소중한 추억 사진입니다.';
    const parts = [];
    if (s1.year) parts.push(`${s1.year}에`);
    if (s1.location) parts.push(`${s1.location}에서`);
    if (s1.people?.length) parts.push(`${s1.people.join(', ')}과(와) 함께`);
    if (s1.captionCategories?.length) {
      s1.captionCategories.forEach((item) => parts.push(`${item.category}: ${item.value}`));
    }
    if (s1.freeText) parts.push(s1.freeText);
    return parts.length ? parts.join(' ') + ' 찍은 사진입니다.' : '소중한 추억 사진입니다.';
  };

  const buildConversationStarters = (step1Data, answersData) => {
    const starters = [];
    if (step1Data?.year) starters.push(`${step1Data.year}에 찍은 이 사진, 어떤 기억이 떠오르시나요?`);
    if (step1Data?.location) starters.push(`${step1Data.location}에서의 특별한 기억이 있으신가요?`);
    if (step1Data?.people?.length) starters.push(`${step1Data.people.join(', ')}과(와) 함께했던 이 날, 어떠셨나요?`);
    (answersData || []).filter(qa => qa.answer).forEach(qa => starters.push(qa.question));
    if (starters.length === 0) starters.push('이 사진을 보시면 어떤 기억이 떠오르시나요?');
    return starters.slice(0, 3);
  };

  const togglePerson = (p) =>
    setPeople(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const updateCaptionCategory = (id, field, value) => {
    setCaptionCategories(prev => prev.map(item => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  };

  const addCaptionCategory = () => {
    setCaptionCategories(prev => [...prev, createCaptionCategory()]);
  };

  const removeCaptionCategory = (id) => {
    setCaptionCategories(prev => (
      prev.length <= 1 ? [createCaptionCategory()] : prev.filter(item => item.id !== id)
    ));
  };

  const CaptionCategoryFields = () => (
    <div className="form-section">
      <label className="form-label">
        보호자 입력 캡션 카테고리
        <span className="form-hint"> (선택 사항)</span>
      </label>
      <p className="form-help-text">
        통화 중 확인하고 싶은 내용을 자유롭게 정해주세요. 예: 인물 - 민석이, 장소 - 제주 바다
      </p>
      <div className="caption-category-list">
        {captionCategories.map((item, index) => (
          <div className="caption-category-row" key={item.id}>
            <input
              className="text-input caption-category-name"
              placeholder="카테고리명"
              value={item.category}
              onChange={e => updateCaptionCategory(item.id, 'category', e.target.value)}
            />
            <input
              className="text-input caption-category-value"
              placeholder="기대 답변"
              value={item.value}
              onChange={e => updateCaptionCategory(item.id, 'value', e.target.value)}
            />
            <button
              type="button"
              className="caption-category-remove"
              onClick={() => removeCaptionCategory(item.id)}
              aria-label={`${index + 1}번째 카테고리 삭제`}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="caption-category-add" onClick={addCaptionCategory}>
        카테고리 추가
      </button>
    </div>
  );

  // ─────────────────────────────────────
  // Firebase 작업
  // ─────────────────────────────────────

  // Canvas로 이미지 압축 → base64 data URL 반환 (Firebase Storage 불가 시 폴백)
  const compressImageToDataURL = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 600;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 로드 실패')); };
      img.src = objectUrl;
    });

  // Firebase Storage REST API로 직접 업로드 (SDK 412 우회)
  const uploadViaRestAPI = async (filePath, file) => {
    const token = await currentUser.getIdToken(true);
    const bucket = 'remind-aa99f.firebasestorage.app';
    const encodedPath = encodeURIComponent(filePath);

    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg', 'Authorization': `Firebase ${token}` },
        body: file,
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`REST API 업로드 실패 (${res.status}): ${errText}`);
    }
    const result = await res.json();
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${result.downloadTokens}`;
  };

  // [Step 0 → Step 1] 사진을 즉시 업로드하고 Firestore 초안 문서 생성
  const uploadPhotoEarly = async (fileArg) => {
    const file = fileArg || selectedFile;
    const rand = Math.random().toString(36).slice(2, 8);
    const fileName = `${Date.now()}_${rand}_${file.name}`;
    const patientId = await getConnectedPatientId(currentUser.uid);
    if (!patientId) throw new Error('연결된 환자 ID를 찾을 수 없습니다.');
    const filePath = `users/${patientId}/photos/${fileName}`;

    let downloadURL = null;
    let storedInFirestore = false;

    // 1차: Firebase SDK
    try {
      const storageRef = ref(storage, filePath);
      const snapshot = await uploadBytes(storageRef, file);
      downloadURL = await getDownloadURL(snapshot.ref);
    } catch (sdkErr) {
      console.warn('Firebase SDK 업로드 실패, REST API 시도:', sdkErr.message);
    }

    // 2차: REST API (SDK 412 우회)
    if (!downloadURL) {
      try {
        downloadURL = await uploadViaRestAPI(filePath, file);
      } catch (restErr) {
        console.warn('REST API도 실패, Firestore 직접 저장으로 전환:', restErr.message);
      }
    }

    // 3차 폴백: Canvas 압축 후 data URL을 Firestore에 직접 저장
    if (!downloadURL) {
      console.warn('Firebase Storage 사용 불가 — Firebase Console에서 Storage 버킷을 재연결하세요.');
      downloadURL = await compressImageToDataURL(file);
      storedInFirestore = true;
    }

    const userPhotosRef = collection(db, 'users', patientId, 'photos');
    const docRef = await addDoc(userPhotosRef, {
      imageUrl: downloadURL,
      photoURL: downloadURL,
      uploadDate: new Date(),
      createdAt: new Date(),
      fileName,
      description: '캡션 작성 중...',
      tag: '통화 전',
      callStatus: '통화전',
      analyzed: false,
      storedInFirestore,   // Storage 복구 후 마이그레이션 식별용
    });
    return docRef.id;
  };

  // 캡션 완성 후 기존 문서 업데이트
  const updateCaption = async (patientId, docId, step1Data, answersData, caption) => {
    if (!docId) return;
    const photoDocRef = doc(db, 'users', patientId, 'photos', docId);
    const starters = buildConversationStarters(step1Data, answersData);
    const desc = caption || buildSimpleCaption(step1Data);
    const normalizedCaptionCategories = normalizeCaptionCategories(step1Data?.captionCategories || []);
    const guardianAnswerKeywords = buildAnswerKeywordsFromCategories(normalizedCaptionCategories);
    await updateDoc(photoDocRef, {
      description: desc,
      detailedDescription: desc,
      analyzed: true,
      year: step1Data?.year || null,
      people: step1Data?.people?.length ? step1Data.people : null,
      location: step1Data?.location || null,
      freeText: step1Data?.freeText || null,
      finalCaption: caption || null,
      conversationStarters: starters,
      captionCategories: normalizedCaptionCategories,
      answerKeywords: guardianAnswerKeywords,
    });
  };

  // 백그라운드 AI 분석 (keywords, emotion, situation, conversationStarters 보강 + 정답 키워드 추출)
  const runBackgroundAnalysis = async (patientId, docId, caption, step1DataForKeywords) => {
    if (!docId) return;
    const photoDocRef = doc(db, 'users', patientId, 'photos', docId);

    // 이미지 분석 (파일이 있을 때만) — emotion, detailedDescription, conversationStarters 보강
    if (selectedFile) {
      try {
        const analysis = await extractKeywordsFromPhoto(selectedFile, caption);
        const update = {};
        if (analysis.emotion) update.emotion = analysis.emotion;
        if (analysis.detailedDescription) update.detailedDescription = analysis.detailedDescription;
        if (analysis.conversationStarters?.length) update.conversationStarters = analysis.conversationStarters;
        if (Object.keys(update).length > 0) await updateDoc(photoDocRef, update);
      } catch (err) {
        console.warn('백그라운드 이미지 분석 실패 (무시):', err);
      }
    }

    // 정답 키워드 추출 (사진 + 캡션 + 보호자 입력 멀티모달 분석)
    try {
      const guardianAnswerKeywords = buildAnswerKeywordsFromCategories(step1DataForKeywords?.captionCategories || []);
      const extractedKeywords = await extractAnswerKeywords(imageBase64, caption, step1DataForKeywords);
      const mergedKeywords = [...guardianAnswerKeywords];
      (extractedKeywords || []).forEach((keyword) => {
        const category = String(keyword.category || '').trim();
        const value = String(keyword.value || '').trim();
        if (!category || !value) return;
        const exists = mergedKeywords.some((item) => item.category === category && item.value === value);
        if (!exists) mergedKeywords.push({ category, value });
      });
      if (mergedKeywords.length > 0) {
        await updateDoc(photoDocRef, { answerKeywords: mergedKeywords });
      }
    } catch (err) {
      console.warn('정답 키워드 추출 실패 (무시):', err);
    }
  };

  // 묶음 업로드: 파일 배열을 순서대로 업로드하고 기본 메타 저장
  const runBatchUpload = async () => {
    const step1Data = buildStep1Data();
    const patientId = await getConnectedPatientId(currentUser.uid);
    if (!patientId) { alert('연결된 환자 ID를 찾을 수 없습니다.'); return; }

    setBatchProgress({ done: 0, total: batchFiles.length });
    setStep('batch_uploading');

    let done = 0;
    for (const { file } of batchFiles) {
      try {
        const docId = await uploadPhotoEarly(file);
        const desc = buildSimpleCaption(step1Data);
        const starters = buildConversationStarters(step1Data, []);
        const normalizedCaptionCategories = normalizeCaptionCategories(step1Data?.captionCategories || []);
        const guardianAnswerKeywords = buildAnswerKeywordsFromCategories(normalizedCaptionCategories);
        const photoDocRef = doc(db, 'users', patientId, 'photos', docId);
        await updateDoc(photoDocRef, {
          description: desc,
          detailedDescription: desc,
          analyzed: true,
          year: step1Data?.year || null,
          people: step1Data?.people?.length ? step1Data.people : null,
          location: step1Data?.location || null,
          freeText: step1Data?.freeText || null,
          finalCaption: desc,
          conversationStarters: starters,
          captionCategories: normalizedCaptionCategories,
          answerKeywords: guardianAnswerKeywords,
        });
      } catch (err) {
        console.error('묶음 업로드 중 오류 (파일 건너뜀):', err);
      }
      done += 1;
      setBatchProgress({ done, total: batchFiles.length });
    }
    setBatchDone(true);
  };

  // ─────────────────────────────────────
  // 플로우 핸들러
  // ─────────────────────────────────────

  // docId 확보 (항상 Promise 반환 — state에 있으면 즉시 resolve, 없으면 업로드 완료 대기)
  const resolveDocId = () =>
    photoDocId ? Promise.resolve(photoDocId) : (docIdPromiseRef.current ?? Promise.resolve(null));

  const startQuestionPrefetch = (step1DataForQuestions) => {
    const requestId = questionRequestIdRef.current + 1;
    questionRequestIdRef.current = requestId;
    setPrefetchedQuestions(null);
    const qPromise = generateFollowUpQuestions(imageBase64, step1DataForQuestions);
    questionPromiseRef.current = qPromise;
    qPromise
      .then(qs => {
        if (questionRequestIdRef.current === requestId) setPrefetchedQuestions(qs);
      })
      .catch(() => {
        if (questionRequestIdRef.current === requestId) setPrefetchedQuestions([]);
      });
    return qPromise;
  };

  // STEP 0: 사진 선택 → 즉시 step1 이동 (업로드 + AI 질문 생성은 백그라운드)
  const handleUploadNext = () => {
    if (!selectedFile) { alert('사진을 선택해주세요.'); return; }

    // 즉시 step1으로 이동 (딜레이 없음)
    setStep('step1');

    // 백그라운드 1: 사진 업로드 + Firestore 초안 생성
    const uploadPromise = uploadPhotoEarly();
    docIdPromiseRef.current = uploadPromise;
    uploadPromise
      .then(docId => setPhotoDocId(docId))
      .catch(err => console.error('백그라운드 업로드 실패:', err));

    // 백그라운드 2: AI 질문 생성 (Step1을 건너뛰는 경우를 위한 사전 생성)
    startQuestionPrefetch(null);
  };

  // STEP 1 → confirm_ai
  const handleStep1Next = () => {
    const s1 = buildStep1Data();
    setSavedStep1(s1);
    startQuestionPrefetch(s1);
    setStep('confirm_ai');
  };

  const handleStep1Skip = () => {
    setSavedStep1(null);
    setStep('confirm_ai');
  };

  // STEP confirm_ai: "아니오" → 즉시 완료 화면 (저장은 백그라운드)
  const handleSkipAI = () => {
    const caption = buildSimpleCaption(savedStep1);
    setFinalCaption(caption);
    setStep('complete');

    // 백그라운드: docId 확정 후 저장
    (async () => {
      try {
        const docId = await resolveDocId();
        if (docId) {
          const patientId = await getConnectedPatientId(currentUser.uid);
          if (!patientId) throw new Error("연결된 환자 ID를 찾을 수 없습니다.");
          await updateCaption(patientId, docId, savedStep1, [], caption);
          runBackgroundAnalysis(patientId, docId, caption, savedStep1);
        }
      } catch (err) {
        console.error('백그라운드 저장 실패:', err);
      }
    })();
  };

  // STEP confirm_ai: "네" → 백그라운드에서 이미 생성 중인 질문 사용 (완료 시 즉시 / 미완료 시 대기)
  const handleStartAI = async () => {
    setStep('step2');

    // 이미 완료된 경우 즉시 표시 (딜레이 없음)
    if (prefetchedQuestions !== null) {
      const questions = prefetchedQuestions;
      setAiQuestions(questions);
      setAiAnswers(questions.map(q => ({ question: q, answer: null })));
      if (questions.length === 0) await runFinish(savedStep1, []);
      return;
    }

    // 아직 생성 중인 경우 남은 시간만 대기
    setIsLoadingQ(true);
    try {
      const questions = await (questionPromiseRef.current || Promise.resolve([]));
      setAiQuestions(questions);
      setAiAnswers(questions.map(q => ({ question: q, answer: null })));
      if (questions.length === 0) await runFinish(savedStep1, []);
    } catch (err) {
      console.error('질문 생성 실패:', err);
      await runFinish(savedStep1, []);
    } finally {
      setIsLoadingQ(false);
    }
  };

  // STEP 2: 질문 답변 or 건너뛰기
  const advanceOrFinish = async (updatedAnswers, idx) => {
    setAiAnswers(updatedAnswers);
    setCurrentAnswer('');
    if (idx < aiQuestions.length - 1) {
      setCurrentQIdx(idx + 1);
    } else {
      await runFinish(savedStep1, updatedAnswers);
    }
  };

  const handleAnswerSubmit = () => {
    const updated = [...aiAnswers];
    updated[currentQIdx] = { question: aiQuestions[currentQIdx], answer: currentAnswer.trim() || null };
    advanceOrFinish(updated, currentQIdx);
  };

  const handleAnswerSkip = () => {
    const updated = [...aiAnswers];
    updated[currentQIdx] = { question: aiQuestions[currentQIdx], answer: null };
    advanceOrFinish(updated, currentQIdx);
  };

  // 최종: 즉시 완료 화면 → 백그라운드에서 AI 캡션 생성 + Firestore 저장
  const runFinish = (step1Data, answers) => {
    const simpleCaption = buildSimpleCaption(step1Data);
    setFinalCaption(simpleCaption);
    setStep('complete');

    (async () => {
      try {
        const docId = await resolveDocId();
        const patientId = await getConnectedPatientId(currentUser.uid);
        if (!patientId) throw new Error("연결된 환자 ID를 찾을 수 없습니다.");
        const aiCaption = await generateFinalCaption(imageBase64, step1Data, answers);
        const finalText = aiCaption || simpleCaption;
        setFinalCaption(finalText); // AI 캡션 완료되면 화면 업데이트
        if (docId) {
          await updateCaption(patientId, docId, step1Data, answers, finalText);
          runBackgroundAnalysis(patientId, docId, finalText, step1Data);
        }
      } catch (err) {
        console.error('백그라운드 캡션 생성/저장 실패:', err);
        try {
          const docId = await resolveDocId();
          const patientId = await getConnectedPatientId(currentUser.uid);
          if (!patientId) throw new Error("연결된 환자 ID를 찾을 수 없습니다.");
          if (docId) await updateCaption(patientId, docId, step1Data, answers, simpleCaption);
        } catch {}
      }
    })();
  };

  // ─────────────────────────────────────
  // 공통 UI
  // ─────────────────────────────────────

  const StepIndicator = () => {
    const current = STEP_IDX[step] ?? 0;
    return (
      <div className="step-indicator">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="step-item-wrap">
            <div className={`step-dot ${i < current ? 'step-done' : i === current ? 'step-current' : 'step-future'}`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`step-label ${i <= current ? 'step-label-active' : ''}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`step-line ${i < current ? 'step-line-done' : ''}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const Header = () => (
    <>
      <div className="header-content">
        <h1 className="header-title">사진 등록</h1>
        {onGoToManagement && (
          <button className="photo-header-button" onClick={onGoToManagement}>사진 관리</button>
        )}
      </div>
      <div className="header-diver" />
    </>
  );

  // ─────────────────────────────────────
  // STEP: upload
  // ─────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="photo-screen">
        <Header />
        <StepIndicator />
        <p className="step-desc">어르신과 함께 볼 추억 사진을 선택해주세요.</p>

        <label htmlFor="photo-input" className="upload-area">
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setSelectedFile(file);
              setPreviewURL(URL.createObjectURL(file));
              const reader = new FileReader();
              reader.onload = (ev) => setImageBase64(ev.target.result.split(',')[1]);
              reader.readAsDataURL(file);
            }}
            style={{ display: 'none' }}
          />
          {previewURL ? (
            <img src={previewURL} alt="미리보기" className="photo-preview-full" />
          ) : (
            <div className="upload-content">
              <div className="upload-icon-circle">
                <img src={upload_icon} className="upload-icon-img" alt="업로드" />
              </div>
              <h3 className="upload-title">사진 업로드</h3>
              <p className="upload-subtitle">사진을 선택하거나 촬영하세요</p>
            </div>
          )}
        </label>

        {selectedFile && (
          <div className="file-info"><p>선택된 파일: {selectedFile.name}</p></div>
        )}

        <div className="action-row">
          <button
            className="btn-primary"
            onClick={handleUploadNext}
            disabled={!selectedFile}
          >
            다음
          </button>
        </div>

        {/* 묶음 업로드 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 12px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
          <span style={{ fontSize: '13px', color: '#aaa', whiteSpace: 'nowrap' }}>또는</span>
          <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
        </div>

        <label htmlFor="batch-input" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', padding: '14px', border: '1.5px dashed #b0b0d0', borderRadius: '12px', color: '#6c63ff', fontSize: '14px', fontWeight: 500 }}>
          <input
            id="batch-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              setBatchFiles(files.map(f => ({ file: f, previewURL: URL.createObjectURL(f) })));
              setStep('batch_info');
            }}
            style={{ display: 'none' }}
          />
          여러 장 한번에 올리기
        </label>
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: batch_info — 묶음 공통 정보 입력
  // ─────────────────────────────────────
  if (step === 'batch_info') {
    return (
      <div className="photo-screen">
        <Header />
        <p className="step-desc">선택한 {batchFiles.length}장의 사진에 적용할 정보를 입력해주세요. 모두 선택 사항입니다.</p>

        {/* 썸네일 미리보기 */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0 12px', marginBottom: '4px' }}>
          {batchFiles.map(({ previewURL: url }, i) => (
            <img key={i} src={url} alt={`사진 ${i + 1}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          ))}
        </div>

        <div className="form-section">
          <label className="form-label">찍은 연도</label>
          <div className="chip-group">
            {YEAR_OPTIONS.map(opt => (
              <button key={opt} className={`chip ${year === opt ? 'chip-selected' : ''}`} onClick={() => setYear(year === opt ? '' : opt)}>{opt}</button>
            ))}
          </div>
          {year === '직접 입력' && (
            <input className="text-input" placeholder="예: 1975년" value={customYear} onChange={e => setCustomYear(e.target.value)} />
          )}
        </div>

        <div className="form-section">
          <label className="form-label">함께한 사람 <span className="form-hint">(복수 선택 가능)</span></label>
          <div className="chip-group">
            {PEOPLE_OPTIONS.map(opt => (
              <button key={opt} className={`chip ${people.includes(opt) ? 'chip-selected' : ''}`} onClick={() => togglePerson(opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">장소</label>
          <div className="chip-group">
            {LOCATION_OPTIONS.map(opt => (
              <button key={opt} className={`chip ${location === opt ? 'chip-selected' : ''}`} onClick={() => setLocation(location === opt ? '' : opt)}>{opt}</button>
            ))}
          </div>
          {location === '기타' && (
            <input className="text-input" placeholder="장소를 직접 입력해주세요" value={customLocation} onChange={e => setCustomLocation(e.target.value)} />
          )}
        </div>

        <CaptionCategoryFields />

        <div className="action-row">
          <button className="btn-skip" onClick={() => { setBatchFiles([]); setStep('upload'); }}>취소</button>
          <button className="btn-primary" onClick={runBatchUpload}>{batchFiles.length}장 업로드</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: batch_uploading — 묶음 업로드 진행 중
  // ─────────────────────────────────────
  if (step === 'batch_uploading') {
    const pct = batchProgress.total > 0 ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0;
    return (
      <div className="photo-screen">
        <Header />
        <div className="center-state" style={{ marginTop: '60px' }}>
          {!batchDone ? (
            <>
              <div className="ai-spinner" />
              <p className="center-text" style={{ marginTop: '20px' }}>{batchProgress.done} / {batchProgress.total}장 업로드 중...</p>
              <div style={{ width: '100%', maxWidth: '300px', height: '8px', background: '#eee', borderRadius: '4px', margin: '16px auto 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#6c63ff', borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
            </>
          ) : (
            <>
              <div className="complete-check-icon" style={{ fontSize: '48px' }}>✓</div>
              <h2 className="complete-title">{batchProgress.done}장 등록 완료!</h2>
              <div className="action-row" style={{ marginTop: '24px' }}>
                <button className="btn-secondary" onClick={onGoToManagement}>사진 관리</button>
                <button className="btn-primary" onClick={onBack}>홈으로</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: step1
  // ─────────────────────────────────────
  if (step === 'step1') {
    return (
      <div className="photo-screen">
        <Header />
        <StepIndicator />
        <p className="step-desc">사진에 대한 기본 정보를 선택해주세요. 모두 선택 사항입니다.</p>

        {previewURL && <img src={previewURL} alt="미리보기" className="photo-preview-small" />}

        {/* 찍은 연도 */}
        <div className="form-section">
          <label className="form-label">찍은 연도</label>
          <div className="chip-group">
            {YEAR_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`chip ${year === opt ? 'chip-selected' : ''}`}
                onClick={() => setYear(year === opt ? '' : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {year === '직접 입력' && (
            <input
              className="text-input"
              placeholder="예: 1975년"
              value={customYear}
              onChange={e => setCustomYear(e.target.value)}
            />
          )}
        </div>

        {/* 함께한 사람 */}
        <div className="form-section">
          <label className="form-label">
            함께한 사람
            <span className="form-hint"> (복수 선택 가능)</span>
          </label>
          <div className="chip-group">
            {PEOPLE_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`chip ${people.includes(opt) ? 'chip-selected' : ''}`}
                onClick={() => togglePerson(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 장소 */}
        <div className="form-section">
          <label className="form-label">장소</label>
          <div className="chip-group">
            {LOCATION_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`chip ${location === opt ? 'chip-selected' : ''}`}
                onClick={() => setLocation(location === opt ? '' : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {location === '기타' && (
            <input
              className="text-input"
              placeholder="장소를 직접 입력해주세요"
              value={customLocation}
              onChange={e => setCustomLocation(e.target.value)}
            />
          )}
        </div>

        {/* 자유 입력 */}
        <div className="form-section">
          <label className="form-label">
            추가로 기억나는 내용이 있으신가요?
            <span className="form-hint"> (선택 사항)</span>
          </label>
          <textarea
            className="description-input"
            placeholder="자유롭게 적어주세요"
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
          />
        </div>

        <CaptionCategoryFields />

        <div className="action-row">
          <button className="btn-skip" onClick={handleStep1Skip}>건너뛰기</button>
          <button className="btn-primary" onClick={handleStep1Next}>다음</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: confirm_ai
  // ─────────────────────────────────────
  if (step === 'confirm_ai') {
    return (
      <div className="photo-screen">
        <Header />
        <StepIndicator />

        <div className="confirm-box">
          <div className="confirm-icon-wrap">🤖</div>
          <h3 className="confirm-title">AI 추가 질문을 받으시겠습니까?</h3>
          <p className="confirm-desc">
            AI가 사진을 분석하여 보호자님께 1~2가지 추가 질문을 드립니다.
            답변을 바탕으로 더 자세하고 풍부한 캡션이 만들어집니다.
          </p>
          <p className="confirm-note">
            ※ 질문 생성에 다소 시간이 걸릴 수 있습니다.
            <br />아니오를 선택하면 입력하신 정보만으로 즉시 저장됩니다.
          </p>
        </div>

        <div className="action-row">
          <button className="btn-skip" onClick={handleSkipAI}>
            아니오, 바로 저장
          </button>
          <button className="btn-primary" onClick={handleStartAI}>
            네, 질문 받기
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: step2
  // ─────────────────────────────────────
  if (step === 'step2') {
    return (
      <div className="photo-screen">
        <Header />
        <StepIndicator />

        {isLoadingQ ? (
          <div className="center-state">
            <div className="ai-spinner" />
            <p className="center-text">AI가 질문을 생성 중입니다...</p>
          </div>
        ) : (
          <>
            <div className="chat-progress-bar">
              <div
                className="chat-progress-fill"
                style={{ width: `${((currentQIdx + 1) / Math.max(aiQuestions.length, 1)) * 100}%` }}
              />
            </div>
            <p className="chat-progress-text">질문 {currentQIdx + 1} / {aiQuestions.length}</p>

            {previewURL && (
              <img src={previewURL} alt="미리보기" className="photo-preview-small" />
            )}

            <div className="chat-container">
              {/* 이전 답변 표시 */}
              {aiAnswers.slice(0, currentQIdx).map((qa, i) => (
                <div key={i} className="chat-exchange">
                  <div className="chat-bubble chat-ai">{qa.question}</div>
                  <div className={`chat-bubble chat-user ${qa.answer === null ? 'chat-skipped' : ''}`}>
                    {qa.answer ?? '(건너뜀)'}
                  </div>
                </div>
              ))}
              {/* 현재 질문 */}
              {aiQuestions[currentQIdx] && (
                <div className="chat-bubble chat-ai">{aiQuestions[currentQIdx]}</div>
              )}
            </div>

            <div className="chat-input-area">
              <textarea
                className="description-input"
                placeholder="답변을 입력해주세요 (Enter로 전송)"
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAnswerSubmit();
                  }
                }}
              />
              <div className="action-row">
                <button className="btn-skip" onClick={handleAnswerSkip}>건너뛰기</button>
                <button className="btn-primary" onClick={handleAnswerSubmit}>
                  {currentQIdx < aiQuestions.length - 1 ? '다음' : '완료'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────
  // STEP: complete
  // ─────────────────────────────────────
  return (
    <div className="photo-screen">
      <Header />
      <StepIndicator />

      <div className="complete-card">
          <div className="complete-check-icon">✓</div>
          <h2 className="complete-title">사진 등록 완료!</h2>

          {previewURL && (
            <img src={previewURL} alt="등록된 사진" className="photo-preview-small" />
          )}

          {/* 수집된 정보 태그 */}
          <div className="info-tags">
            {savedStep1?.year && <span className="info-tag">📅 {savedStep1.year}</span>}
            {savedStep1?.people?.length > 0 && <span className="info-tag">👥 {savedStep1.people.join(', ')}</span>}
            {savedStep1?.location && <span className="info-tag">📍 {savedStep1.location}</span>}
          </div>

          {/* 캡션 미리보기 */}
          <div className="caption-preview-box">
            <div className="caption-preview-label">생성된 캡션</div>
            <p className="caption-preview-text">
              {finalCaption || '캡션을 생성하지 못했습니다.'}
            </p>
          </div>

          <div className="action-row">
            <button className="btn-secondary" onClick={onGoToManagement}>사진 관리</button>
            <button className="btn-primary" onClick={onBack}>홈으로</button>
          </div>
        </div>
    </div>
  );
}

export default PhotoScreen;
