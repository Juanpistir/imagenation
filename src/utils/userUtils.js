import { getLogger } from './logger.js';

const logger = getLogger('userUtils');

export function normalizeUserData(user, includeAuth = true) {
  if (!user) return null;

  try {
    const normalizedUser = {
      uid: user.uid || user.id,
      email: user.email || '',
      username: user.username || user.email?.split('@')[0] || '',
      displayName: user.displayName || user.username || user.email?.split('@')[0] || '',
      photoURL: user.photoURL || user.picture || '',
      bio: user.bio || '',
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null,
      role: user.role || 'user',
      isActive: user.isActive !== false,
    };

    if (includeAuth) {
      normalizedUser.isAuthenticated = true;
    }

    return normalizedUser;
  } catch (error) {
    logger.error('Error normalizando datos de usuario:', error);
    return null;
  }
}

export function prepareUserDataForClient(userData, includeImages = false) {
  if (!userData) return null;

  const profileData = {
    id: userData.uid || userData.id,
    uid: userData.uid || userData.id, // Mantener ambos para compatibilidad
    email: userData.email || '',
    username: userData.username || '',
    displayName: userData.displayName || '',
    photoURL: userData.photoURL || '',
    bio: userData.bio || '',
    createdAt: userData.createdAt || null,
    updatedAt: userData.updatedAt || null,
    role: userData.role || 'user',
    isActive: userData.isActive !== false,
  };

  if (includeImages && Array.isArray(userData.images)) {
    profileData.images = userData.images;
  }

  return profileData;
}

export function prepareUserDataForStorage(userData) {
  if (!userData) {
    throw new Error('userData es requerido');
  }

  const now = new Date();
  const timestamp = {
    createdAt: userData.createdAt || now,
    updatedAt: userData.updatedAt || now,
  };

  return {
    email: userData.email || '',
    username: userData.username || userData.email?.split('@')[0] || '',
    displayName: userData.displayName || userData.username || userData.email?.split('@')[0] || '',
    photoURL: userData.photoURL || '',
    bio: userData.bio || '',
    role: userData.role || 'user',
    isActive: userData.isActive !== false,
    ...timestamp,
  };
}
