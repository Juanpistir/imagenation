import { getLogger } from './logger.js';

const logger = getLogger('userUtils');

// URL por defecto para avatares de usuario
const DEFAULT_AVATAR_URL = 'https://www.gravatar.com/avatar/0?d=mp';

function normalizeBasicUserData(user) {
  if (!user) return null;
  
  try {
    return {
      uid: user.uid || user.id,
      email: user.email || '',
      username: user.username || user.email?.split('@')[0] || '',  // Mantener este fallback para consistencia
      displayName: user.displayName || user.username || user.email?.split('@')[0] || '', // Mantener fallback para UI
      photoURL: user.photoURL || DEFAULT_AVATAR_URL,
      bio: user.bio || '',
      role: user.role || 'user',
      isActive: user.isActive !== false,
    };
  } catch (error) {
    logger.error('Error normalizando datos básicos de usuario:', error);
    return null;
  }
}

export function normalizeUserData(user, includeAuth = true) {
  const normalized = normalizeBasicUserData(user);
  if (!normalized) return null;
  
  try {
    return {
      ...normalized,
      ...(includeAuth && { isAuthenticated: true })
    };
  } catch (error) {
    logger.error('Error normalizando datos de usuario:', error);
    return null;
  }
}

export function prepareUserDataForClient(userData, includeImages = false) {
  const normalized = normalizeBasicUserData(userData);
  if (!normalized) return null;

  try {
    const clientData = {
      ...normalized,
      id: normalized.uid, // Mantener id para compatibilidad con el frontend
    };

    if (includeImages && Array.isArray(userData.images)) {
      clientData.images = userData.images;
    }

    return clientData;
  } catch (error) {
    logger.error('Error preparando datos de usuario para el cliente:', error);
    return null;
  }
}

export function prepareUserDataForStorage(userData) {
  const normalized = normalizeBasicUserData(userData);
  if (!normalized) {
    throw new Error('userData es requerido');
  }

  try {
    const now = new Date();
    return {
      ...normalized,
      createdAt: userData.createdAt || now,
      updatedAt: now
    };
  } catch (error) {
    logger.error('Error preparando datos de usuario para almacenamiento:', error);
    throw error; // Re-lanzar el error ya que es crítico para el almacenamiento
  }
}
