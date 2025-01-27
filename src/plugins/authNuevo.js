import fp from 'fastify-plugin';
import { adminDb, verifyFirebaseToken } from '../config/firebase.js';

async function firebaseAuth(fastify, options) {
  const FBAuth = async (req, reply) => {
    const token = req.cookies?.firebaseToken || req.headers.authorization?.split('Bearer ')[1];

    req.user = null;
    reply.locals.user = null;

    if (token) {
      try {
        const decodedToken = await verifyFirebaseToken(token);
        
        // Obtener datos completos del usuario desde Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        if (userData) {
          const normalizedUser = {
            isAuthenticated: true,
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: userData.displayName || '',
            username: userData.username || '',
            photoURL: userData.photoURL || '',
            bio: userData.bio || '',
            name: userData.displayName || decodedToken.email.split('@')[0],
          };

          req.user = normalizedUser;
          reply.locals.user = normalizedUser;
        }
      } catch (error) {
        if (error.code === 'auth/id-token-expired') {
          req.log.warn('⚠️ Token expired - Renewal needed');
        } else {
          req.log.error(`Authentication error: ${error.code}`);
        }
        reply.clearCookie('firebaseToken');
      }
    }

    return;
  };

  fastify.decorate('FBAuth', FBAuth);
}

export default fp(firebaseAuth, {
  name: 'firebase-auth-plugin',
});
