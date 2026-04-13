/**
 * 사진 랜더마이제이션 서비스
 * 공개 폴더에서 사진을 로드하고 랜덤하게 선택합니다.
 */

// 사진 폴더 경로 정의
const PHOTO_CATEGORIES = {
  memories: '/assets/photos/memories',
  family: '/assets/photos/family',
  activities: '/assets/photos/activities',
  nature: '/assets/photos/nature',
  places: '/assets/photos/places'
};

/**
 * 지정된 카테고리에서 랜덤 사진을 가져옵니다.
 * @param {string} category - 사진 카테고리 (memories, family, activities, nature, places)
 * @returns {Promise<string>} 사진 경로
 */
export const getRandomPhoto = async (category = 'memories') => {
  try {
    const folderPath = PHOTO_CATEGORIES[category] || PHOTO_CATEGORIES.memories;
    
    // 공개 폴더의 사진을 가져옵니다
    // 주의: 이 방법은 공개 폴더 구조에 따라 다를 수 있습니다.
    // 실시간으로 파일을 읽기는 어려우므로, 사전에 정의된 목록을 사용하거나
    // 백엔드 API를 사용해야 합니다.
    
    // 대체 방법: 알려진 사진 파일 목록
    const samplePhotos = {
      memories: [
        '/assets/photos/memories/photo1.jpg',
        '/assets/photos/memories/photo2.jpg',
        '/assets/photos/memories/photo3.jpg',
      ],
      family: [
        '/assets/photos/family/photo1.jpg',
        '/assets/photos/family/photo2.jpg',
        '/assets/photos/family/photo3.jpg',
      ],
      activities: [
        '/assets/photos/activities/photo1.jpg',
        '/assets/photos/activities/photo2.jpg',
        '/assets/photos/activities/photo3.jpg',
      ],
      nature: [
        '/assets/photos/nature/photo1.jpg',
        '/assets/photos/nature/photo2.jpg',
        '/assets/photos/nature/photo3.jpg',
      ],
      places: [
        '/assets/photos/places/photo1.jpg',
        '/assets/photos/places/photo2.jpg',
        '/assets/photos/places/photo3.jpg',
      ]
    };

    const photos = samplePhotos[category] || samplePhotos.memories;
    if (photos.length === 0) return null;

    // 랜덤 사진 선택
    const randomIndex = Math.floor(Math.random() * photos.length);
    return photos[randomIndex];
  } catch (error) {
    console.error('사진 로드 오류:', error);
    return null;
  }
};

/**
 * 여러 카테고리에서 랜덤 사진을 가져옵니다.
 * @param {number} count - 가져올 사진 개수
 * @returns {Promise<Array>} 사진 경로 배열
 */
export const getRandomPhotos = async (count = 5) => {
  try {
    const photos = [];
    const categories = Object.keys(PHOTO_CATEGORIES);
    
    for (let i = 0; i < count; i++) {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const photo = await getRandomPhoto(randomCategory);
      if (photo) photos.push(photo);
    }
    
    return photos;
  } catch (error) {
    console.error('사진 여러 개 로드 오류:', error);
    return [];
  }
};

/**
 * 특정 카테고리에서 여러 개의 랜덤 사진을 가져옵니다.
 * @param {string} category - 사진 카테고리
 * @param {number} count - 가져올 사진 개수
 * @returns {Promise<Array>} 사진 경로 배열
 */
export const getRandomPhotosFromCategory = async (category = 'memories', count = 3) => {
  try {
    const samplePhotos = {
      memories: [
        '/assets/photos/memories/photo1.jpg',
        '/assets/photos/memories/photo2.jpg',
        '/assets/photos/memories/photo3.jpg',
      ],
      family: [
        '/assets/photos/family/photo1.jpg',
        '/assets/photos/family/photo2.jpg',
        '/assets/photos/family/photo3.jpg',
      ],
      activities: [
        '/assets/photos/activities/photo1.jpg',
        '/assets/photos/activities/photo2.jpg',
        '/assets/photos/activities/photo3.jpg',
      ],
      nature: [
        '/assets/photos/nature/photo1.jpg',
        '/assets/photos/nature/photo2.jpg',
        '/assets/photos/nature/photo3.jpg',
      ],
      places: [
        '/assets/photos/places/photo1.jpg',
        '/assets/photos/places/photo2.jpg',
        '/assets/photos/places/photo3.jpg',
      ]
    };

    const photos = samplePhotos[category] || samplePhotos.memories;
    const shuffled = [...photos].sort(() => Math.random() - 0.5);
    
    return shuffled.slice(0, Math.min(count, shuffled.length));
  } catch (error) {
    console.error('카테고리 사진 로드 오류:', error);
    return [];
  }
};

/**
 * 사진 폴더 구조 정보를 반환합니다.
 * @returns {Object} 폴더 구조 정보
 */
export const getPhotoFolderInfo = () => {
  return {
    categories: PHOTO_CATEGORIES,
    instructions: `
      사진 폴더 구조:
      public/assets/photos/
      ├── memories/     (추억 사진)
      ├── family/       (가족 사진)
      ├── activities/   (활동 사진)
      ├── nature/       (자연 사진)
      └── places/       (장소 사진)
      
      각 폴더에 사진을 추가하세요. (JPG, PNG 등)
      사진 파일명: photo1.jpg, photo2.jpg, photo3.jpg 등
    `
  };
};

export default {
  getRandomPhoto,
  getRandomPhotos,
  getRandomPhotosFromCategory,
  getPhotoFolderInfo,
  PHOTO_CATEGORIES
};
