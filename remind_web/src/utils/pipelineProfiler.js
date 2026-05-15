// Pipeline profiling utility — controlled by VITE_PIPELINE_PROFILING=true
// Import profiler anywhere in the pipeline and call mark(key) at each stage.
// Prints a full timing report at the end of each TTS playback cycle.

export const ENABLE_PIPELINE_PROFILING =
  import.meta.env.VITE_PIPELINE_PROFILING === 'true';

const LABELS = {
  T1: '발화 시작',
  T2: 'VAD 종료 감지',
  T3: 'STT 완료',
  T5: 'LLM 응답 완료 (비스트리밍)',
  T6: 'TTS 오디오 수신 완료 (HTTP)',
  T7: '첫 음성 재생 시작',
  T8: 'TTS 마지막 청크 (HTTP = T6)',
};

// Chronological order for the report
const ORDER = ['T1', 'T2', 'T3', 'T5', 'T6', 'T7', 'T8'];

let _t = {};

export const profiler = {
  // Call at the start of each user speech cycle to clear previous cycle's data
  reset() {
    _t = {};
  },

  // Record a timestamp for the given key (T1–T8).
  // First call for a key wins; subsequent calls are ignored.
  mark(key) {
    if (!ENABLE_PIPELINE_PROFILING) return;
    if (_t[key] == null) _t[key] = Date.now();
  },

  // Print the full pipeline timing report for the current cycle.
  // Call this after T8 (audio playback ends).
  report() {
    if (!ENABLE_PIPELINE_PROFILING) return;
    if (_t.T1 == null) return;

    const base = _t.T1;
    let prev = null;

    console.group('[Pipeline] ─── 사이클 타이밍 리포트 ───');
    for (const key of ORDER) {
      const ts = _t[key];
      if (ts == null) continue;
      const fromStart = ts - base;
      const prevNote =
        prev != null ? ` (이전 단계 +${ts - prev}ms)` : ' (기준점)';
      const highlight = key === 'T7' ? '  ← 어르신 체감 응답 시간' : '';
      console.log(
        `[Pipeline] ${key} ${LABELS[key]}: +${fromStart}ms${prevNote}${highlight}`
      );
      prev = ts;
    }
    console.groupEnd();
  },
};
