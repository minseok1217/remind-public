import { useState, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, listAll, getBytes, deleteObject } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import './PhotoManagementScreen.css';

function PhotoManagementScreen({ currentUser }) {
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadPhotos();
    }
  }, [currentUser]);

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      // Firestore에서 사진 메타데이터 불러오기 (사용자별)
      const userPhotosRef = collection(db, 'guardians', currentUser.uid, 'photos');
      const snapshot = await getDocs(userPhotosRef);
      
      const photoList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPhotos(photoList);
    } catch (error) {
      console.error('사진 불러오기 실패:', error);
    }
    setIsLoading(false);
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('이 사진을 삭제하시겠습니까?')) {
      return;
    }

    setDeletingId(photoId);
    try {
      // Firestore에서 삭제
      const photoRef = doc(db, 'guardians', currentUser.uid, 'photos', photoId);
      await deleteDoc(photoRef);

      // Storage에서 삭제 (필요한 경우)
      setPhotos(photos.filter(p => p.id !== photoId));
      alert('사진이 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPhotos = selectedTag === 'all' 
    ? photos 
    : photos.filter(p => {
        const status = p.callStatus || p.tag;
        return status === selectedTag;
      });

  const tags = ['통화전', '통화후'];
  
  // 통화전 사진 (callStatus가 '통화전'이거나 tag가 '통화 전'인 경우)
  const preCallPhotos = photos.filter(p => 
    p.callStatus === '통화전' || (p.tag === '통화 전' && !p.callStatus)
  );
  
  // 통화후 사진
  const postCallPhotos = photos.filter(p => 
    p.callStatus === '통화후' || p.tag === '통화 후'
  );

  return (
    <div className="photo-management-screen">
      <div className="management-header">
        <h1>사진 관리</h1>
        <div className="photo-count">
          <span>등록된 사진 ({photos.length})</span>
        </div>
      </div>

      {/* Info Alert */}
      <div className="info-alert">
        <span className="alert-icon">ℹ️</span>
        <p>등록된 사진은 AI가 자동으로 분석하여 태그, 설명, 날짜가 채워집니다.</p>
      </div>

      {/* Analysis Status */}
      <div className="analysis-status">
        <div className="status-badge">
          <span className="status-icon">📞</span>
          <span className="status-text">통화 전: {preCallPhotos.length}개</span>
        </div>
        <div className="status-badge completed">
          <span className="status-icon">✅</span>
          <span className="status-text">통화 후: {postCallPhotos.length}개</span>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="tags-container">
        <button 
          className={`tag-btn ${selectedTag === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedTag('all')}
        >
          전체 ({photos.length})
        </button>
        <button 
          className={`tag-btn ${selectedTag === '통화전' ? 'active' : ''}`}
          onClick={() => setSelectedTag('통화전')}
        >
          통화 전 ({preCallPhotos.length})
        </button>
        <button 
          className={`tag-btn ${selectedTag === '통화후' ? 'active' : ''}`}
          onClick={() => setSelectedTag('통화후')}
        >
          통화 후 ({postCallPhotos.length})
        </button>
      </div>

      {/* Photos Grid - 전체 사진 */}
      {photos.length > 0 && (
        <div className="photos-grid">
          {(selectedTag === 'all' ? photos : selectedTag === '통화전' ? preCallPhotos : postCallPhotos).map(photo => (
            <div key={photo.id} className={`photo-card ${photo.callStatus === '통화후' || photo.tag === '통화 후' ? 'completed' : 'pre-call'}`}>
              <div className="photo-image-container">
                <img 
                  src={photo.photoURL || photo.imageUrl} 
                  alt={photo.description || '사진'}
                  className="photo-image"
                />
                <div className="call-status-badge">
                  {photo.callStatus === '통화후' || photo.tag === '통화 후' ? '✅ 통화 완료' : '📞 통화 대기'}
                </div>
              </div>
              <div className="photo-info">
                <h3 className="photo-name">{photo.description || photo.name || '사진'}</h3>
                {photo.keywords?.emotion && (
                  <p className="photo-emotion">분위기: {photo.keywords.emotion}</p>
                )}
                <div className="photo-meta">
                  <span className={`photo-tag ${photo.callStatus === '통화후' || photo.tag === '통화 후' ? 'completed-tag' : 'pre-call-tag'}`}>
                    {photo.callStatus === '통화후' || photo.tag === '통화 후' ? '통화 후' : '통화 전'}
                  </span>
                  <button
                    className={`delete-btn ${deletingId === photo.id ? 'deleting' : ''}`}
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingId === photo.id}
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {isLoading ? (
        <div className="loading-message">사진을 불러오는 중입니다...</div>
      ) : photos.length === 0 ? (
        <div className="empty-message">
          <p>등록된 사진이 없습니다.</p>
          <p className="empty-submessage">새로운 사진을 등록해주세요.</p>
        </div>
      ) : null}
    </div>
  );
}

export default PhotoManagementScreen;
