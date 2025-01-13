// Importaciones de Firebase Admin
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

console.log(' Iniciando configuración de Firebase Admin...');

// Configuración de credenciales
const serviceAccount = {
    type: process.env.FIREBASE_TYPE || "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// Verificar que todas las credenciales necesarias estén presentes
const requiredCredentials = [
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'client_x509_cert_url'
];

const missingCredentials = requiredCredentials.filter(cred => !serviceAccount[cred]);

if (missingCredentials.length > 0) {
    console.error('❌ Error: Faltan las siguientes credenciales de Firebase:', missingCredentials);
    throw new Error('Credenciales de Firebase incompletas');
}

try {
  console.log(' [FIREBASE-ADMIN] Verificando si ya existe una instancia...');
  const existingApp = admin.apps.length ? admin.app() : null;
  
  if (existingApp) {
    console.log(' [FIREBASE-ADMIN] Usando instancia existente');
  } else {
    console.log(' [FIREBASE-ADMIN] Inicializando nueva instancia...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log(' [FIREBASE-ADMIN] Nueva instancia inicializada');
  }

  // Inicializar servicios
  console.log(' [FIREBASE-ADMIN] Inicializando servicios...');
  const db = getFirestore();
  const auth = getAuth();
  const storage = getStorage();
  console.log(' [FIREBASE-ADMIN] Servicios inicializados correctamente');

  // Verificar conexión a Firestore
  console.log(' [FIREBASE-ADMIN] Verificando conexión a Firestore...');
  db.collection('test').doc('test').set({ test: true })
    .then(() => {
      console.log(' [FIREBASE-ADMIN] Conexión a Firestore verificada');
      db.collection('test').doc('test').delete();
    })
    .catch(error => {
      console.error(' [FIREBASE-ADMIN] Error al verificar Firestore:', error);
    });

  module.exports = { admin, db, auth, storage };
} catch (error) {
  console.error(' [FIREBASE-ADMIN] Error en la inicialización:', error);
  console.error(' [FIREBASE-ADMIN] Stack trace:', error.stack);
  throw error;
}
