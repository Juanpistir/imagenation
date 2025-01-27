import { adminDb, adminAuth } from '../config/firebase.js';
import { getLogger } from '../utils/logger.js';
import { errors } from '../utils/error-handler.js';
import { generateInitialAvatar } from '../utils/avatarUtils.js';
import { prepareUserDataForStorage, prepareUserDataForClient } from '../utils/userUtils.js';

const logger = getLogger('auth:controller');

// URL por defecto para avatares de usuario
const DEFAULT_AVATAR_URL = 'https://www.gravatar.com/avatar/0?d=mp';

export async function login(request, reply) {
  logger.info('Iniciando sesión');
  if (request.user) {
    return reply.redirect('/');
  }
  return reply.view('/auth/login.hbs', {
    user: request.user,
    error: request.query.error,
  });
}

export async function register(request, reply) {
  logger.info('Registrando nuevo usuario');
  if (request.user) {
    return reply.redirect('/');
  }
  return reply.view('/auth/register.hbs', {
    user: request.user,
    error: request.query.error,
  });
}

async function generateUniqueUsername(baseUsername) {
  try {
    // Buscar usuarios con username similar
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef
      .where('username', '>=', baseUsername)
      .where('username', '<=', baseUsername + '\uf8ff')
      .get();

    if (snapshot.empty) {
      return baseUsername;
    }

    // Obtener el número más alto actual
    const usernames = snapshot.docs.map((doc) => doc.data().username);
    let maxNumber = 0;

    usernames.forEach((username) => {
      const match = username.match(new RegExp(`^${baseUsername}(\\d+)?$`));
      if (match && match[1]) {
        const num = parseInt(match[1]);
        maxNumber = Math.max(maxNumber, num);
      }
    });

    return `${baseUsername}${maxNumber + 1}`;
  } catch (error) {
    logger.error('Error generando username único:', error);
    throw error;
  }
}

export async function createUserInDatabase(request, reply) {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Email y contraseña son requeridos',
      });
    }

    const baseUsername = email.split('@')[0].toLowerCase();
    const username = await generateUniqueUsername(baseUsername);

    // Generar avatar inicial (lo guardamos en Firestore pero usamos URL por defecto para Auth)
    const initialAvatar = generateInitialAvatar(username);

    // 1. Crear usuario en Firebase Auth con URL válida
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: username,
        photoURL: DEFAULT_AVATAR_URL, // Usar URL válida para Auth
      });
    } catch (authError) {
      logger.error('Error creando usuario en Firebase Auth:', authError);
      return reply.code(400).send({
        error: 'Authentication Error',
        message: authError.message || 'Error al crear usuario en autenticación',
      });
    }

    // 2. Preparar datos para Firestore (aquí sí podemos usar el SVG)
    const userData = prepareUserDataForStorage({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: username,
      username: username,
      photoURL: initialAvatar, // Guardar el SVG en Firestore
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Guardar en Firestore
    try {
      await adminDb.collection('users').doc(userRecord.uid).set(userData);
    } catch (dbError) {
      logger.error('Error guardando usuario en Firestore:', dbError);
      // Limpiar usuario de Auth si falla Firestore
      try {
        await adminAuth.deleteUser(userRecord.uid);
        logger.info('Usuario eliminado de Auth después de error en Firestore:', userRecord.uid);
      } catch (cleanupError) {
        logger.error('Error al limpiar usuario de Auth:', cleanupError);
      }
      throw dbError;
    }

    // 4. Preparar respuesta para el cliente
    const clientData = prepareUserDataForClient({
      ...userData,
      uid: userRecord.uid,
    });

    return reply.code(201).send({
      success: true,
      user: clientData,
    });
  } catch (error) {
    logger.error('Error creando usuario:', error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Error al crear usuario',
    });
  }
}
