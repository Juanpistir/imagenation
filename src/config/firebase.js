import { cert, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('Firebase Admin Config', '');

// Crear objeto de credenciales de admin
const adminCredentials = {
  type: 'service_account',
  project_id: 'imagenation-node',
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

// Variables para exportar
let adminApp;
let adminAuth;
let adminDb;

try {
  // Inicializar Firebase Admin
  adminApp = initializeAdminApp({
    credential: cert(adminCredentials),
    projectId: 'imagenation-node',
  });

  adminAuth = getAdminAuth(adminApp);
  adminDb = getFirestore(adminApp);

  logger.info('Firebase Admin SDK inicializado correctamente');
} catch (error) {
  logger.error('Error inicializando Firebase Admin:', error);
  throw error;
}

// Función para verificar token de Firebase
export async function verifyFirebaseToken(token) {
  try {
    if (!token) {
      throw new Error('No se proporcionó token');
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    logger.error('Error verificando token:', error);
    throw error;
  }
}

export { adminApp, adminAuth, adminDb };
