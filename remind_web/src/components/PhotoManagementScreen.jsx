import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import './PhotoManagementScreen.css';

const STATUS_PRE = '통화전';
const STATUS_POST = '통화후';

const normalizeCallStatus = (value) => (value || '').replace(/\s+/g, '');

const getPhotoStatus = (photo) => normalizeCallStatus(photo.callStatus || photo.tag);

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
      const userPhotosRef = collection(db, 'users', currentUser.uid, 'photos');
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
      const photoRef = doc(db, 'users', currentUser.uid, 'photos', photoId);
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

  const preCallPhotos = photos.filter((p) => getPhotoStatus(p) === STATUS_PRE);
  const postCallPhotos = photos.filter((p) => getPhotoStatus(p) === STATUS_POST);
  const visiblePhotos = selectedTag === 'all'
    ? photos
    : (selectedTag === STATUS_PRE ? preCallPhotos : postCallPhotos);

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
          className={`tag-btn ${selectedTag === STATUS_PRE ? 'active' : ''}`}
          onClick={() => setSelectedTag(STATUS_PRE)}
        >
          통화 전 ({preCallPhotos.length})
        </button>
        <button 
          className={`tag-btn ${selectedTag === STATUS_POST ? 'active' : ''}`}
          onClick={() => setSelectedTag(STATUS_POST)}
        >
          통화 후 ({postCallPhotos.length})
        </button>
      </div>

      {/* Photos Grid - 전체 사진 */}
      {photos.length > 0 && (
        <div className="photos-grid">
          {visiblePhotos.map(photo => {
            const isCompleted = getPhotoStatus(photo) === STATUS_POST;
            return (
            <div key={photo.id} className={`photo-card ${isCompleted ? 'completed' : 'pre-call'}`}>
              <div className="photo-image-container">
                <img 
                  src={photo.photoURL || photo.imageUrl} 
                  alt={photo.description || '사진'}
                  className="photo-image"
                />
                <div className="call-status-badge">
                  {isCompleted ? '✅ 통화 완료' : '📞 통화 대기'}
                </div>
              </div>
              <div className="photo-info">
                <h3 className="photo-name">{photo.description || photo.name || '사진'}</h3>
                {photo.keywords?.emotion && (
                  <p className="photo-emotion">분위기: {photo.keywords.emotion}</p>
                )}
                <div className="photo-meta">
                  <span className={`photo-tag ${isCompleted ? 'completed-tag' : 'pre-call-tag'}`}>
                    {isCompleted ? '통화 후' : '통화 전'}
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
          )})}
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
