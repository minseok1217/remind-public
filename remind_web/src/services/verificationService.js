// 인증번호 관리 서비스

// 메모리 저장소 (실제 구현시 백엔드/Firebase 사용 권장)
const verificationCodes = new Map();

// 6자리 랜덤 인증번호 생성
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 인증번호 저장 (5분 유효)
export const saveVerificationCode = (phoneNumber, code) => {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5분 후 만료
  verificationCodes.set(phoneNumber, {
    code,
    expiresAt,
    attempts: 0
  });
  return code;
};

// 인증번호 검증
export const verifyCode = (phoneNumber, inputCode) => {
  const stored = verificationCodes.get(phoneNumber);
  
  if (!stored) {
    return { success: false, message: '인증번호가 존재하지 않습니다.' };
  }

  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phoneNumber);
    return { success: false, message: '인증번호가 만료되었습니다.' };
  }

  if (stored.attempts >= 5) {
    verificationCodes.delete(phoneNumber);
    return { success: false, message: '인증 시도 횟수를 초과했습니다. 다시 신청해주세요.' };
  }

  if (stored.code !== inputCode) {
    stored.attempts++;
    return { success: false, message: '인증번호가 일치하지 않습니다.' };
  }

  verificationCodes.delete(phoneNumber);
  return { success: true, message: '인증되었습니다.' };
};

// 인증번호 재전송 (쿨다운 1분)
const resendCooldown = new Map();

export const canResendCode = (phoneNumber) => {
  const lastSent = resendCooldown.get(phoneNumber);
  if (!lastSent) return true;
  
  const elapsed = Date.now() - lastSent;
  return elapsed > 60 * 1000; // 1분 이상 경과
};

export const updateLastResendTime = (phoneNumber) => {
  resendCooldown.set(phoneNumber, Date.now());
};

// 전화번호 형식 검증
export const validatePhoneNumber = (phoneNumber) => {
  const regex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
  return regex.test(phoneNumber);
};

// 전화번호 포맷팅
export const formatPhoneNumber = (phoneNumber) => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6) + '-' + cleaned.slice(6);
  }
  if (cleaned.length === 11) {
    return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 7) + '-' + cleaned.slice(7);
  }
  return phoneNumber;
};
