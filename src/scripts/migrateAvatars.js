import { adminDb } from '../config/firebase.js';
import { generateInitialAvatar } from '../utils/avatarUtils.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('Avatar Migration');

async function migrateUserAvatars() {
  try {
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.get();
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      if (!userData.photoURL) {
        const username = userData.username || userData.email.split('@')[0];
        const initialAvatar = generateInitialAvatar(username);
        
        await doc.ref.update({
          photoURL: initialAvatar,
          updatedAt: new Date()
        });
        
        logger.info(`Avatar actualizado para: ${username}`);
      }
    }
    
    logger.info('Migración completada');
  } catch (error) {
    logger.error('Error en migración:', error);
    process.exit(1);
  }
}

migrateUserAvatars(); 