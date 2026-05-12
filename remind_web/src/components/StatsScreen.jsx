import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { calculateWeeklyTrend } from '../services/conversationAnalysisService';
import './StatsScreen.css';
import call_icon from '../assets/call_icon.png';
import search_icon from '../assets/search_icon.png';

function StatsScreen({ currentUser, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [periodTab, setPeriodTab] = useState('7days'); // '7days' | '30days'
  const [allLogs, setAllLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [callRecords, setCallRecords] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null); // 선택된 날짜 포인트
  const [dateRangeString, setDateRangeString] = useState(''); // 현재 표시되는 날짜 범위 문자열

  useEffect(() => {
    if (currentUser) {
      loadAllLogs();
    }
  }, [currentUser]);

  useEffect(() => {
    if (allLogs.length > 0) {
      computeStats(allLogs, periodTab);
      setSelectedPoint(null); // 기간 변경 시 선택 초기화
    }
  }, [periodTab, allLogs, setDateRangeString]);

  const loadAllLogs = async () => {
    try {
      let targetUserId = currentUser.uid;

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === '보호자') {
          const familyLinksRef = collection(db, 'family_links');
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid), where('status', '==', '연결됨'));
          const familySnapshot = await getDocs(familyQuery);

          if (!familySnapshot.empty) {
            targetUserId = familySnapshot.docs[0].data().patient_id;
          } 
        }
      }

      const callLogsRef = collection(db, 'call_logs');
      const callQuery = query(callLogsRef, where('userId', '==', targetUserId));
      const callSnapshot = await getDocs(callQuery);

      const logs = callSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort((a, b) => {
        const dateA = a.callDate?.toDate?.() || new Date(0);
        const dateB = b.callDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setAllLogs(logs);

      if (logs.length === 0) {
        setStats({
          score: 0,
          trend: [],
          message: '통화 기록이 없습니다',
          detail: '통화를 시작하면 인지 상태 분석이 시작됩니다.',
          statusColor: '#999',
          statusLabel: '데이터 없음'
        });
        setCallRecords([]);
      }
    } catch (error) {
      console.error('[StatsScreen] 데이터 로드 실패:', error.message, error.code, error);
      alert(`데이터 로드 실패: ${error.message}. 콘솔을 확인해주세요.`);
      setStats({
        score: 0,
        trend: [],
        message: '데이터 로드 실패',
        detail: error.message,
        statusColor: '#f44336',
        statusLabel: '오류'
      });
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (logs, period) => {
    const days = period === '7days' ? 7 : 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1)); // (days - 1)을 사용하여 정확한 범위 계산

    const formatMonthDay = (date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}월 ${day}일`;
    };

    const newDateRangeString = `${formatMonthDay(startDate)} ~ ${formatMonthDay(endDate)}`;
    setDateRangeString(newDateRangeString); // 새로운 state에 날짜 범위 저장
    
    const cutoff = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); // 시작 날짜를 기준으로 cutoff 설정

    const filtered = logs.filter(log => {
      const d = log.callDate?.toDate?.() || new Date(0);
      return d >= cutoff;
    });

    if (filtered.length === 0) {
      setStats({
        score: 0,
        trend: [],
        message: '해당 기간 통화 기록이 없습니다',
        detail: '통화를 시작하면 인지 상태 분석이 시작됩니다.',
        statusColor: '#999',
        statusLabel: '데이터 없음'
      });
      setCallRecords([]);
      return;
    }

    const weeklyTrend = calculateWeeklyTrend(filtered);
    const latestLog = filtered[0];
    const latestAnalysis = latestLog.analysis;
    // 최신 점수를 크게 표시 (평균 아님)
    const latestScore = latestAnalysis?.scores?.cognitive || latestLog.cognitiveScore || 0;

    let statusLabel = latestAnalysis?.status?.label || '분석 중';
    let statusColor = latestAnalysis?.status?.color || '#41d17f';
    let detail = latestAnalysis?.insights?.join(' ') || '통화 데이터를 분석 중입니다.';

    if (weeklyTrend.improvement > 5) {
      detail += ` 지난 주 대비 ${weeklyTrend.improvement}점 상승했습니다!`;
    } else if (weeklyTrend.improvement < -5) {
      detail += ` 지난 주 대비 ${Math.abs(weeklyTrend.improvement)}점 하락했습니다.`;
    }

    setStats({
      score: latestScore,  // 최신 점수 표시
      trend: weeklyTrend.trend,
      message: statusLabel,
      detail,
      statusColor,
      statusLabel
    });

    // 통화 기록 포맷팅 (최근 5건)
    const formattedRecords = filtered.slice(0, 5).map(log => formatCallRecord(log));
    setCallRecords(formattedRecords);
  };

  const formatCallRecord = (log) => {
    const logDate = log.callDate?.toDate?.() || new Date();
    const month = logDate.getMonth() + 1;
    const day = logDate.getDate();
    const hours = String(logDate.getHours()).padStart(2, '0');
    const minutes = String(logDate.getMinutes()).padStart(2, '0');
    const durMin = Math.floor((log.callDuration || 0) / 60);
    const durSec = (log.callDuration || 0) % 60;

    const statusLabel = log.analysis?.status?.label || (log.analysis ? '분석 완료' : '분석 불가');
    const statusColor = log.analysis?.status?.color || (log.analysis ? '#41d17f' : '#999');
    let badgeType = 'normal';
    if (statusLabel === '매우 양호' || statusLabel === '양호') badgeType = 'good';
    else if (statusLabel === '주의 필요' || statusLabel === '관심 필요') badgeType = 'warning';
    else if (statusLabel === '분석 불가') badgeType = 'unavailable';

    return {
      id: log.id,
      rawLog: log,
      date: `${month}월 ${day}일`,
      time: `${hours}:${minutes}`,
      duration: `${durMin}분 ${durSec}초`,
      statusLabel,
      statusColor,
      badgeType,
      cognitiveScore: log.cognitiveScore || log.analysis?.scores?.cognitive || 0
    };
  };

  // 동적 차트 포인트 생성
  const generateChartPoints = (trend) => {
    if (!trend || trend.length === 0) return { line: '', area: '', points: [] };

    const width = 460;
    const height = 150;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - 20;

    const maxValue = Math.max(...trend.map(t => t.value), 100);
    const minValue = Math.min(...trend.map(t => t.value), 0);
    const valueRange = maxValue - minValue || 1;

    const points = trend.map((item, index) => {
      const x = padding + (index / (trend.length - 1 || 1)) * chartWidth;
      const y = height - padding - ((item.value - minValue) / valueRange) * chartHeight;
      return { x, y, date: item.date, value: item.value };
    });

    const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = linePoints + ` ${points[points.length - 1]?.x || 0},${height} ${points[0]?.x || 0},${height}`;

    return { line: linePoints, area: areaPoints, points };
  };

  const chartData = generateChartPoints(stats?.trend || []);

  const handleViewAllHistory = () => {
    if (onNavigate) {
      onNavigate('callHistory', { logs: allLogs });
    }
  };

  const handleCallClick = (record) => {
    if (onNavigate) {
      onNavigate('callDetail', { callLog: record.rawLog });
    }
  };

  if (loading) {
    return (
      <div className="stats-screen">
        <div className="stats-header">
          <button className="stats-back-btn" onClick={onBack}>←</button>
          <h1>통계</h1>
        </div>
        <div className="stats-loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="stats-screen">
      <div className="header-content">
        <h1 className="header-title">통계</h1>
      </div>
      <div className="header-diver"></div>

      {/* Period Tabs */}
      <div className="period-tabs">
        <button
          className={`period-tab ${periodTab === '7days' ? 'active' : ''}`}
          onClick={() => setPeriodTab('7days')}
        >
          최근 7일
        </button>
        <button
          className={`period-tab ${periodTab === '30days' ? 'active' : ''}`}
          onClick={() => setPeriodTab('30days')}
        >
          최근 30일
        </button>
      </div>
      
      {/* Score Card */}
      <div className="score-card">
        <div className="score-header">
          <div className="score-label">인지 상태 변화</div>
          <div className="date-range">{dateRangeString}</div>
        </div>

        {/* Chart */}
        <div className="cognitive-chart">
          {chartData.points.length > 0 ? (
            <svg viewBox="0 0 500 180" preserveAspectRatio="xMidYMid meet">
              <line x1="30" y1="160" x2="470" y2="160" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="30" y1="110" x2="470" y2="110" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="30" y1="60" x2="470" y2="60" stroke="#f0f0f0" strokeWidth="1" />

              <defs>
                <linearGradient id="statsAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={stats?.statusColor || '#41d17f'} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={stats?.statusColor || '#41d17f'} stopOpacity="0" />
                </linearGradient>
              </defs>

              <polygon points={chartData.area} fill="url(#statsAreaGradient)" />
              <polyline
                points={chartData.line}
                fill="none"
                stroke={stats?.statusColor || '#41d17f'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chartData.points.map((point, index) => {
                // 말풍선 위치 조정 (가장자리에서 잘리지 않도록)
                const isLast = index === chartData.points.length - 1;
                const isFirst = index === 0;
                let tooltipX = point.x;
                let textAnchor = 'middle';
                
                if (isLast && point.x > 440) {
                  tooltipX = point.x - 25;
                  textAnchor = 'end';
                } else if (isFirst && point.x < 60) {
                  tooltipX = point.x + 25;
                  textAnchor = 'start';
                }
                
                return (
                <g key={index} onClick={() => setSelectedPoint(selectedPoint === index ? null : index)} style={{ cursor: 'pointer' }}>
                  {/* 선택된 포인트 점수 표시 */}
                  {selectedPoint === index && (
                    <>
                      <rect 
                        x={tooltipX - 25} 
                        y={point.y - 35} 
                        width="50" 
                        height="24" 
                        rx="5" 
                        fill={stats?.statusColor || '#41d17f'} 
                      />
                      <text 
                        x={tooltipX} 
                        y={point.y - 18} 
                        fontSize="12" 
                        fill="white" 
                        textAnchor="middle" 
                        fontWeight="bold"
                      >
                        {point.value}점
                      </text>
                      <polygon 
                        points={`${point.x - 5},${point.y - 11} ${point.x + 5},${point.y - 11} ${point.x},${point.y - 5}`} 
                        fill={stats?.statusColor || '#41d17f'} 
                      />
                    </>
                  )}
                  {/* 클릭 가능 영역 확대 */}
                  <circle cx={point.x} cy={point.y} r="15" fill="transparent" />
                  {/* 실제 포인트 */}
                  <circle 
                    cx={point.x} 
                    cy={point.y} 
                    r={selectedPoint === index ? 6 : 4} 
                    fill={selectedPoint === index ? stats?.statusColor || '#41d17f' : 'white'} 
                    stroke={stats?.statusColor || '#41d17f'} 
                    strokeWidth="2" 
                  />
                  <text x={point.x} y="178" fontSize="10" fill={selectedPoint === index ? stats?.statusColor || '#41d17f' : '#aaa'} textAnchor="middle" fontWeight={selectedPoint === index ? 'bold' : 'normal'}>{point.date}</text>
                </g>
              )})}
            </svg>
          ) : (
            <div className="no-chart-data">차트 데이터가 없습니다</div>
          )}
        </div>

        {/* Score Display */}
        {/*
        <div className="score-display">
          <div className="big-score">{stats.score}점</div>
        </div>
        */}
      </div>

      {/* Message Box */}
      <div className="message-box">
        <div className="message-main-label">
          <img src={search_icon} className="icon-tiny" />
          <div className="message-label">{stats?.message || '분석 중'}</div>
        </div>
        <p className="message-detail">{stats?.detail || ''}</p>
      </div>

      {/* Call History Section */}
      <div className="call-history">
        <div className="section-header">
          <h3>통화 이력</h3>
          <button className="view-all" onClick={handleViewAllHistory}>전체 보기 &rsaquo;</button>
        </div>

        <div className="call-list">
          {callRecords.length === 0 ? (
            <div className="no-records">통화 기록이 없습니다.</div>
          ) : (
            callRecords.slice(0,3).map((record) => (
            <div key={record.id} className="call-item" onClick={() => handleCallClick(record)}>
              <div className="call-list-icon">
                <img src={call_icon} className="call_icon_img" alt="전화 아이콘" />
              </div>
              <div className="call-info-content">
                <div className="call-detail">날짜: {record.date}</div>
                <div className="call-detail">시간: {record.time}</div>
                <div className="call-detail">통화 시간: {record.duration}</div>
              </div>
              <span className={`call-status-value ${record.status=="분석 불가" ? 'status-disabled' : (record.status=="주의 필요" ? 'status-warning' : 'status-good')}`}>{record.statusLabel}</span>
              <div className="call-arrow">›</div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}

export default StatsScreen;
