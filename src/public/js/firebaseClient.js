// Configuración de Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyBM7ltd823a-xacz4YzKCN7n-HfFU6rHCc',
  authDomain: 'imagenation-node.firebaseapp.com',
  projectId: 'imagenation-node',
  storageBucket: 'imagenation-node.firebasestorage.app',
  messagingSenderId: '679409973529',
  appId: '1:679409973529:web:29aa0ac3a5dca2f2da6d88',
  measurementId: 'G-968RQ8MJ1P'
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Funciones de autenticación
const auth = firebase.auth();

const signIn = async (email, password) => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

const signUp = async (email, password) => {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

const logOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    throw error;
  }
};

// Exportar funciones
window.firebaseClient = {
  auth,
  signIn,
  signUp,
  logOut,
};
