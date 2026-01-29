import { useState } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import './PhotoScreen.css';

function PhotoScreen({ currentUser, onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !photoDescription) {
      alert('사진과 설명을 모두 입력해주세요.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Firebase Storage에 업로드 (사용자별 폴더)
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, `users/${currentUser.uid}/photos/${fileName}`);
      
      setUploadProgress(30);
      
      const snapshot = await uploadBytes(storageRef, selectedFile);
      
      setUploadProgress(60);
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setUploadProgress(80);

      // Firestore에 메타데이터 저장 (users/{userId}/photos 컬렉션)
      const userPhotosRef = collection(db, 'users', currentUser.uid, 'photos');
      await addDoc(userPhotosRef, {
        imageUrl: downloadURL,
        uploadDate: new Date(),
        fileName: fileName,
        // 초기 정보 (사용자가 입력)
        description: photoDescription,
        date: new Date().toISOString().split('T')[0],
        tag: '통화 전',
        // AI 분석 예약 필드
        name: null,
        analyzed: false
      });

      setUploadProgress(100);

      // 성공 메시지
      alert('✅ 사진이 등록되었습니다!');
      
      // 초기화
      setSelectedFile(null);
      setPhotoDescription('');
      setUploadProgress(0);
      
      // 잠깐 후 메인으로 돌아가기
      setTimeout(() => {
        onBack();
      }, 1500);
      
    } catch (error) {
      console.error('업로드 실패:', error);
      alert(`❌ 업로드 실패: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="photo-screen">
      <div className="header-with-back">
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <h1>사진 등록</h1>
      </div>

      <div className="description-text">
        <p>사기 등록 중 고교로 사진을 업로드하고 사진 설명을 입력해서 사진을 인증해주세요.</p>
      </div>

      {/* Upload Area */}
      <div className="upload-container">
        <label htmlFor="photo-input" className="upload-area">
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
          <div className="upload-content">
            <div className="upload-icon">📸</div>
            <h3 className="upload-title">사진 업로드</h3>
            <p className="upload-subtitle">신청해서 사진 찾기</p>
          </div>
        </label>

        {selectedFile && (
          <div className="file-info">
            <p>✅ 선택된 파일: {selectedFile.name}</p>
          </div>
        )}
      </div>

      {/* Description Section */}
      <div className="description-section">
        <label htmlFor="photo-desc">사진 설명</label>
        <textarea
          id="photo-desc"
          className="description-input"
          placeholder="이 사진에 대한 설명을 입력해주세요.&#10;(예: 오늘 찍은 사진입니다)"
          value={photoDescription}
          onChange={(e) => setPhotoDescription(e.target.value)}
          disabled={isUploading}
        />
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="progress-text">업로드 중... {uploadProgress}%</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="action-section">
        <button 
          className="action-button" 
          onClick={handleSubmit}
          disabled={isUploading}
        >
          {isUploading ? `업로드 중... ${uploadProgress}%` : '등록 하기'}
        </button>
      </div>
    </div>
  );
}

export default PhotoScreen;
