import { useState } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { extractKeywordsFromPhoto } from '../services/geminiService';
import './PhotoScreen.css';

function PhotoScreen({ currentUser, onBack, onGoToManagement }) {
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

  // 백그라운드에서 키워드 분석 및 업데이트 (사용자를 기다리게 하지 않음)
  const analyzeAndUpdateKeywords = async (photoDocId, imageFile, description) => {
    console.log('🔍 백그라운드 키워드 분석 시작:', { photoDocId, fileName: imageFile.name });
    try {
      const analysisResult = await extractKeywordsFromPhoto(imageFile, description);
      console.log('✅ 백그라운드 분석 완료 - 결과:', analysisResult);
      
      // Firestore 문서 업데이트
      const photoDocRef = doc(db, 'guardians', currentUser.uid, 'photos', photoDocId);
      await updateDoc(photoDocRef, {
        keywords: analysisResult.keywords || [],
        detailedDescription: analysisResult.detailedDescription || '',
        people: analysisResult.people || [],
        location: analysisResult.location || '',
        emotion: analysisResult.emotion || '',
        situation: analysisResult.situation || '',
        conversationStarters: analysisResult.conversationStarters || [],
        analyzed: true
      });
      
      console.log('✅ Firebase 업데이트 완료 - 키워드 저장됨');
    } catch (error) {
      console.error('❌ 백그라운드 분석 실패:', error);
      console.error('❌ 에러 상세:', error.message, error.stack);
      // 에러가 발생해도 무시 (사진은 이미 등록됨)
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
      
      setUploadProgress(50);
      
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setUploadProgress(75);

      // Firestore에 메타데이터 저장 (사용자는 기다리지 않음)
      console.log('📝 Firestore 저장 시작:', { uid: currentUser.uid, fileName });
      const userPhotosRef = collection(db, 'guardians', currentUser.uid, 'photos');
      console.log('📝 Collection 참조:', userPhotosRef.path);
      
      const docRef = await addDoc(userPhotosRef, {
        imageUrl: downloadURL,
        photoURL: downloadURL,
        uploadDate: new Date(),
        createdAt: new Date(),
        fileName: fileName,
        // 보호자가 입력한 설명
        description: photoDescription,
        date: new Date().toISOString().split('T')[0],
        tag: '통화 전',
        callStatus: '통화전',
        // 초기값 (백그라운드에서 업데이트될 예정)
        keywords: [],
        analyzed: false
      });
      
      console.log('✅ Firestore 저장 완료:', docRef.id);

      setUploadProgress(100);

      // 성공 메시지 - 사용자는 바로 보임
      alert('✅ 사진이 등록되었습니다!');
      
      // 초기화
      setSelectedFile(null);
      setPhotoDescription('');
      setUploadProgress(0);
      
      // 잠깐 후 메인으로 돌아가기
      setTimeout(() => {
        onBack();
      }, 1000);

      // 백그라운드에서 AI 분석 (비동기로 진행)
      console.log('🚀 백그라운드 분석 호출:', { docId: docRef.id, fileSize: selectedFile.size });
      analyzeAndUpdateKeywords(docRef.id, selectedFile, photoDescription);
      
    } catch (error) {
      console.error('업로드 실패:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);
      alert(`❌ 업로드 실패: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="photo-screen">
      <div className="header-with-back">
        <button className="back-button" onClick={onBack} title="뒤로가기">←</button>
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
        {onGoToManagement && (
          <button 
            className="action-button secondary" 
            onClick={onGoToManagement}
            disabled={isUploading}
          >
            사진 관리하기 →
          </button>
        )}
      </div>
    </div>
  );
}

export default PhotoScreen;
