import './SplashScreen.css';

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">
          {/* Infinity Symbol SVG */}
          <svg 
            className="splash-infinity" 
            viewBox="0 0 100 50" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M25 25 C25 15, 35 10, 45 15 C55 20, 55 30, 45 35 C35 40, 25 35, 25 25 M75 25 C75 35, 65 40, 55 35 C45 30, 45 20, 55 15 C65 10, 75 15, 75 25"
              fill="none"
              stroke="#41d17f"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="splash-logo-text">REMIND CALL</div>
          <div className="splash-logo-subtitle">기억을 잇다, 마음을 잇다</div>
        </div>
        <div className="splash-loading">
          <div className="splash-dots">
            <div className="splash-dot"></div>
            <div className="splash-dot"></div>
            <div className="splash-dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
