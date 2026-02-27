import { useState } from 'react';
import './StatsScreen.css';
import call_icon from '../assets/call_icon.png';
import search_icon from '../assets/search_icon.png';

function StatsScreen({ currentUser, onBack }) {
  const [selectedCall, setSelectedCall] = useState(null);

  const stats = {
    score: 75,
    dateRange: '01월 01일 ~ 01월 07일',
    trend: [
      { date: '01.01', value: 65 },
      { date: '01.02', value: 68 },
      { date: '01.03', value: 70 },
      { date: '01.04', value: 72 },
      { date: '01.05', value: 73 },
      { date: '01.06', value: 74 },
      { date: '01.07', value: 75 }
    ],
    message: '안정적 상태입니다.',
    detail: '지난 주 대비 기억력 관련 단어 사용이 증가했습니다. 규칙적인 통화가 긍정적인 영향을 주고 있어요.'
  };

  const callRecords = [
    {
      id: 1,
      date: '2026년 1월 3일',
      time: '03시',
      caller: '보낸 002없던 0월 03월',
      duration: '전화 시간: 15분 20초',
      status: '통화 완료'
    },
    {
      id: 2,
      date: '2026년 1월 2일',
      time: '02시',
      caller: '보낸 002없던 0월 02월',
      duration: '전화 시간: 13분 20초',
      status: '주의 필요'
    }
  ];

  return (
    <div className="stats-screen">
      <div className="header-content">
        <h1 className="header-title">계정 관리 및 설정</h1>
      </div>
      <div className="header-diver"></div>

      {/* Score Card */}
      <div className="score-card">
        <div className="score-header">
          <div className="score-label">인지 상태 변화</div>
          <div className="date-range">{stats.dateRange}</div>
        </div>

        <div className="chart-container">
          <div className="chart">
            <svg viewBox="0 0 500 200" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              <line x1="20" y1="180" x2="480" y2="180" stroke="#e0e0e0" strokeWidth="1" />
              <line x1="20" y1="130" x2="480" y2="130" stroke="#e0e0e0" strokeWidth="1" />
              <line x1="20" y1="80" x2="480" y2="80" stroke="#e0e0e0" strokeWidth="1" />
              <line x1="20" y1="30" x2="480" y2="30" stroke="#e0e0e0" strokeWidth="1" />

              {/* Area under curve */}
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#41d17f" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#41d17f" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Line */}
              <polyline
                points="30,155 100,148 170,138 240,128 310,120 380,115 450,108"
                fill="none"
                stroke="#41d17f"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Area */}
              <polygon
                points="30,155 100,148 170,138 240,128 310,120 380,115 450,108 450,200 30,200"
                fill="url(#areaGradient)"
              />

              {/* Data points */}
              <circle cx="30" cy="155" r="4" fill="#41d17f" />
              <circle cx="100" cy="148" r="4" fill="#41d17f" />
              <circle cx="170" cy="138" r="4" fill="#41d17f" />
              <circle cx="240" cy="128" r="4" fill="#41d17f" />
              <circle cx="310" cy="120" r="4" fill="#41d17f" />
              <circle cx="380" cy="115" r="4" fill="#41d17f" />
              <circle cx="450" cy="108" r="4" fill="#41d17f" />

              {/* X-axis labels */}
              <text x="30" y="195" fontSize="12" fill="#999" textAnchor="middle">01.01</text>
              <text x="100" y="195" fontSize="12" fill="#999" textAnchor="middle">01.02</text>
              <text x="170" y="195" fontSize="12" fill="#999" textAnchor="middle">01.03</text>
              <text x="240" y="195" fontSize="12" fill="#999" textAnchor="middle">01.04</text>
              <text x="310" y="195" fontSize="12" fill="#999" textAnchor="middle">01.05</text>
              <text x="380" y="195" fontSize="12" fill="#999" textAnchor="middle">01.06</text>
              <text x="450" y="195" fontSize="12" fill="#999" textAnchor="middle">01.07</text>
            </svg>
          </div>
        </div>

        {/* Score Display */}
        <div className="score-display">
          <div className="big-score">{stats.score}점</div>
        </div>
      </div>

      {/* Message Box */}
      <div className="message-box">
        <div className="message-main-label">
          <img src={search_icon} className="icon-tiny" />
          <div className="message-label">{stats.message}</div>
        </div>
        <p className="message-detail">{stats.detail}</p>
      </div>

      {/* Call History Section */}
      <div className="call-history">
        <div className="section-header">
          <h3>통화 이력</h3>
          <a href="#" className="view-all">전체 보기</a>
        </div>

        <div className="call-list">
          {callRecords.map((record) => (
            <div key={record.id} className="call-item">
              <div className="call-list-icon">
                <img src={call_icon} className="call_icon_img" alt="전화 아이콘" />
              </div>
              <div className="call-info-content">
                <div className="call-detail">날짜: {record.date}</div>
                <div className="call-detail">시간: {record.time}</div>
                <div className="call-detail">{record.duration}</div>
              </div>
              <span className={`call-status-value ${record.status=="분석 불가" ? 'status-disabled' : (record.status=="주의 필요" ? 'status-warning' : 'status-good')}`}>{record.status}</span>
              <div className="call-arrow">›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StatsScreen;
