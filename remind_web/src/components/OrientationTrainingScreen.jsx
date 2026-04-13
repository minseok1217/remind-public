import { useState } from 'react';
import './OrientationTrainingScreen.css';

// 난이도별 지남력 훈련 질문 세트
// difficulty: '상' | '중' | '하'
const buildOrientationQuestions = (difficulty) => {
  const now = new Date();
  const days = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const seasons = [null,'겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'];
  const currentSeason = seasons[now.getMonth() + 1];
  const currentDay = days[now.getDay()];

  // 공통 시간/계절 질문
  const timeQuestions = [
    {
      id: 'ot1',
      question: '오늘은 무슨 요일입니까?',
      type: 'choice',
      choices: ['월요일','화요일','수요일','목요일','금요일','토요일','일요일'],
      correct: currentDay,
      hint: '오늘 날짜를 생각해 보세요.',
    },
    {
      id: 'ot2',
      question: '지금은 무슨 계절입니까?',
      type: 'choice-img',
      choices: [
        { label: '봄 🌸', value: '봄' },
        { label: '여름 ☀️', value: '여름' },
        { label: '가을 🍂', value: '가을' },
        { label: '겨울 ❄️', value: '겨울' },
      ],
      correct: currentSeason,
      hint: '창밖의 날씨를 생각해 보세요.',
    },
  ];

  // 물건 용도 질문 (이미지 대신 이모지)
  const objectQuestions_low = [
    {
      id: 'obj1',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '🧹',
      objectName: '빗자루',
      type: 'choice',
      choices: ['바닥을 쓸 때 쓰는 물건', '음식을 먹을 때 쓰는 물건', '더울 때 시원하게 해주는 물건', '앉을 때 쓰는 물건'],
      correct: '바닥을 쓸 때 쓰는 물건',
      hint: '청소할 때 쓰는 물건입니다.',
    },
    {
      id: 'obj2',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '☕',
      objectName: '컵',
      type: 'choice',
      choices: ['음료를 마실 때 쓰는 물건', '바닥을 청소할 때 쓰는 물건', '글씨를 쓸 때 쓰는 물건', '머리를 빗을 때 쓰는 물건'],
      correct: '음료를 마실 때 쓰는 물건',
      hint: '물이나 음료를 담는 물건입니다.',
    },
  ];

  const objectQuestions_mid = [
    {
      id: 'obj3',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '✂️',
      objectName: '가위',
      type: 'choice',
      choices: ['무언가를 자를 때 쓰는 물건', '무언가를 붙일 때 쓰는 물건', '무언가를 쓸 때 쓰는 물건', '시간을 볼 때 쓰는 물건'],
      correct: '무언가를 자를 때 쓰는 물건',
      hint: '종이나 실 등을 자르는 물건입니다.',
    },
    {
      id: 'obj4',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '📞',
      objectName: '전화기',
      type: 'choice',
      choices: ['통화할 때 쓰는 물건', '시간을 알려주는 물건', '음식을 만들 때 쓰는 물건', '글씨를 지울 때 쓰는 물건'],
      correct: '통화할 때 쓰는 물건',
      hint: '멀리 있는 사람과 이야기할 때 씁니다.',
    },
  ];

  const objectQuestions_high = [
    {
      id: 'obj5',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '🩺',
      objectName: '청진기',
      type: 'choice',
      choices: ['심장 소리를 들을 때 쓰는 물건', '혈압을 잴 때 쓰는 물건', '체온을 잴 때 쓰는 물건', '음식을 만들 때 쓰는 물건'],
      correct: '심장 소리를 들을 때 쓰는 물건',
      hint: '의사 선생님이 사용하는 물건입니다.',
    },
    {
      id: 'obj6',
      question: '이 물건은 무엇에 사용하는 것일까요?',
      emoji: '🔬',
      objectName: '돋보기',
      type: 'choice',
      choices: ['작은 것을 크게 볼 때 쓰는 물건', '멀리 있는 것을 볼 때 쓰는 물건', '사진을 찍을 때 쓰는 물건', '빛을 만들어낼 때 쓰는 물건'],
      correct: '작은 것을 크게 볼 때 쓰는 물건',
      hint: '글씨나 작은 물건을 크게 보이게 합니다.',
    },
  ];

  // 난이도별 구성
  if (difficulty === '하') {
    return [...timeQuestions, ...objectQuestions_low];
  } else if (difficulty === '중') {
    return [...timeQuestions, ...objectQuestions_mid];
  } else {
    // '상' 또는 기본
    return [...timeQuestions, ...objectQuestions_high];
  }
};

export default function OrientationTrainingScreen({ difficulty = '중', onComplete, onBack }) {
  const questions = buildOrientationQuestions(difficulty);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState('question'); // 'question' | 'feedback' | 'complete'
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const currentQ = questions[currentIdx];

  const handleSelect = (value) => {
    if (selectedAnswer !== null) return; // 이미 선택함
    const correct = value === currentQ.correct;
    setSelectedAnswer(value);
    setIsCorrect(correct);
    if (correct) setCorrectCount(prev => prev + 1);
    setPhase('feedback');
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsCorrect(false);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setPhase('question');
    } else {
      setPhase('complete');
    }
  };

  const progress = ((currentIdx + 1) / questions.length) * 100;

  // 완료 화면
  if (phase === 'complete') {
    const isPerfect = correctCount === questions.length;
    return (
      <div className="orientation-screen">
        <div className="orientation-card">
          <div className="orientation-complete-icon">
            {isPerfect ? '🌟' : '👍'}
          </div>
          <h2 className="orientation-complete-title">
            {isPerfect ? '완벽해요!' : '잘 하셨어요!'}
          </h2>
          <p className="orientation-complete-score">
            {questions.length}문제 중 <strong>{correctCount}문제</strong> 정답
          </p>
          <p className="orientation-complete-msg">
            이제 AI와 통화를 시작할게요.<br />
            편안하게 이야기 나눠 보세요! 😊
          </p>
          <button className="orientation-btn-primary" onClick={onComplete}>
            통화 시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orientation-screen">
      {/* 헤더 */}
      <div className="orientation-header">
        <button className="orientation-back-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <span className="orientation-header-title">지남력 훈련</span>
        <span className="orientation-header-step">{currentIdx + 1}/{questions.length}</span>
      </div>

      {/* 진행바 */}
      <div className="orientation-progress-track">
        <div className="orientation-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="orientation-card">
        {/* 물건 이모지 (있을 때만) */}
        {currentQ.emoji && (
          <div className="orientation-emoji-box">
            <span className="orientation-emoji">{currentQ.emoji}</span>
          </div>
        )}

        {/* 질문 */}
        <p className="orientation-question">{currentQ.question}</p>

        {/* 선택지 */}
        {phase === 'question' && (
          <div className="orientation-choices">
            {currentQ.choices.map((c, i) => {
              const val = typeof c === 'object' ? c.value : c;
              const label = typeof c === 'object' ? c.label : c;
              return (
                <button
                  key={i}
                  className="orientation-choice-btn"
                  onClick={() => handleSelect(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* 피드백 */}
        {phase === 'feedback' && (
          <div className="orientation-feedback">
            <div className={`orientation-feedback-banner ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? (
                <span>✅ 정답이에요!</span>
              ) : (
                <span>❌ 아쉽지만 틀렸어요</span>
              )}
            </div>

            {!isCorrect && (
              <div className="orientation-correct-answer">
                <span className="orientation-correct-label">정답:</span>
                <span className="orientation-correct-text">{currentQ.correct}</span>
              </div>
            )}

            <p className="orientation-hint">{currentQ.hint}</p>

            <button className="orientation-btn-primary" onClick={handleNext}>
              {currentIdx + 1 < questions.length ? '다음 문제' : '훈련 완료'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
