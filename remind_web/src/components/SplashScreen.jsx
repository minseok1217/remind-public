import './SplashScreen.css';
import logo from '../assets/logo.png';

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">
          <img className="splash-infinity" src={logo} alt="로고" />
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
