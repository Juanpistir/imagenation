const User = require('../models/user');
const { auth, clientAuth, db } = require('../config/firebase.config');
const { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema
} = require('../schemas/auth.schema');
const { createLogger, format, transports } = require('winston');
const { signInWithEmailAndPassword } = require('firebase/auth');

// Configurar logger
const logger = createLogger({
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `🕒 ${timestamp} | ${level} | 🔑 Auth Service | ${message} ${metaStr}`;
    })
  ),
  transports: [new transports.Console()]
});

async function updateUserLastLogin(uid) {
  try {
    if (!uid) {
      throw new Error('UID es requerido para actualizar last login');
    }

    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      lastLogin: new Date(),
      updatedAt: new Date()
    }, { merge: true });

    logger.info('Last login actualizado exitosamente', { uid });
  } catch (error) {
    logger.warn('Error updating last login:', { error: error.message });
  }
}

async function createUserIfNotExists(userData) {
  try {
    if (!userData.uid) {
      throw new Error('UID es requerido para crear usuario');
    }

    const userRef = db.collection('users').doc(userData.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid: userData.uid,
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        roles: ['user'],
        status: 'active'
      });
      logger.info('Usuario creado exitosamente', { uid: userData.uid });
    }

    return userDoc.exists ? userDoc.data() : await userRef.get().then(doc => doc.data());
  } catch (error) {
    logger.error('Error creating user:', { error: error.message });
    throw error;
  }
}

class AuthController {
  async register(request, reply) {
    try {
      // Validar datos usando Zod
      const validatedData = registerSchema.parse(request.body);

      try {
        // Verificar si el email ya está registrado
        const userRecord = await auth.getUserByEmail(validatedData.email);
        if (userRecord) {
          return reply.code(400).send({ 
            error: 'Email en uso',
            details: 'Este email ya está registrado'
          });
        }
      } catch (error) {
        // Si el error es user-not-found, podemos continuar
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({
        email: validatedData.email,
        password: validatedData.password,
        displayName: validatedData.username
      });

      // Crear documento de usuario en Firestore
      const userData = await createUserIfNotExists({
        uid: userRecord.uid,
        email: validatedData.email,
        username: validatedData.username
      });

      // Generar token JWT
      const token = await reply.jwtSign({
        uid: userRecord.uid,
        email: userRecord.email,
        roles: userData.roles || ['user']
      });

      logger.info('Registration successful', { uid: userRecord.uid });
      return reply.send({
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          username: userData.username,
          roles: userData.roles
        }
      });
    } catch (error) {
      logger.error('Registration error:', { error: error.message });
      
      // Manejar errores de validación de Zod
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Datos inválidos',
          details: error.errors[0].message
        });
      }
      
      // Manejar errores específicos de Firebase Auth
      if (error.code === 'auth/email-already-exists') {
        return reply.code(400).send({
          error: 'Email en uso',
          details: 'Este email ya está registrado'
        });
      }
      
      if (error.code === 'auth/invalid-password') {
        return reply.code(400).send({
          error: 'Contraseña inválida',
          details: 'La contraseña no cumple con los requisitos de seguridad'
        });
      }
      
      return reply.code(500).send({ 
        error: 'Error en el registro',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
      });
    }
  }

  async login(request, reply) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        logger.warn('Login attempt without credentials');
        return reply.code(400).send({ 
          error: 'Credenciales requeridas',
          details: 'Debe proporcionar email y contraseña'
        });
      }

      try {
        // Iniciar sesión con Firebase
        const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
        const { user } = userCredential;

        if (!user) {
          logger.error('No user returned from Firebase');
          return reply.code(401).send({
            error: 'Error de autenticación',
            details: 'No se pudo autenticar el usuario'
          });
        }

        logger.info('Firebase authentication successful', { 
          uid: user.uid,
          email: user.email 
        });

        // Obtener o crear el usuario en Firestore
        const userData = await createUserIfNotExists({
          uid: user.uid,
          email: user.email,
          username: user.displayName || email.split('@')[0]
        });

        // Actualizar último login
        await updateUserLastLogin(user.uid);

        // Generar token JWT
        const token = await reply.jwtSign({ 
          uid: user.uid,
          email: user.email,
          roles: userData.roles || ['user']
        });

        logger.info('Login successful', { uid: user.uid });
        return reply.send({ 
          token,
          user: {
            uid: user.uid,
            email: user.email,
            username: userData.username,
            roles: userData.roles
          }
        });
      } catch (firebaseError) {
        logger.error('Firebase authentication error:', { error: firebaseError.message });
        return reply.code(401).send({
          error: 'Credenciales inválidas',
          details: 'Email o contraseña incorrectos'
        });
      }
    } catch (error) {
      logger.error('Login error:', { error: error.message });
      return reply.code(500).send({
        error: 'Error en el login',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
      });
    }
  }

  async logout(request, reply) {
    try {
      // Destruir sesión
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        await request.server.destroySession(sessionId);
      }

      // Limpiar cookie
      reply.clearCookie('sessionId', {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
      });

      return { success: true };
    } catch (error) {
      request.log.error('Error en logout:', error);
      throw error;
    }
  }

  async forgotPassword(request, reply) {
    try {
      const validatedData = forgotPasswordSchema.parse(request.body);
      
      // Enviar email de recuperación
      await auth.generatePasswordResetLink(validatedData.email);
      
      return {
        success: true,
        message: 'Se ha enviado un email con las instrucciones para recuperar tu contraseña'
      };
    } catch (error) {
      request.log.error('Error en recuperación de contraseña:', error);
      throw error;
    }
  }

  async resetPassword(request, reply) {
    try {
      const validatedData = resetPasswordSchema.parse(request.body);
      
      // Verificar token y actualizar contraseña
      await auth.verifyPasswordResetCode(validatedData.token);
      await auth.confirmPasswordReset(validatedData.token, validatedData.password);
      
      return {
        success: true,
        message: 'Contraseña actualizada correctamente'
      };
    } catch (error) {
      request.log.error('Error en reset de contraseña:', error);
      throw error;
    }
  }

  async changePassword(request, reply) {
    try {
      const validatedData = changePasswordSchema.parse(request.body);
      
      // Reautenticar usuario
      const user = auth.currentUser;
      const credential = auth.EmailAuthProvider.credential(
        user.email,
        validatedData.currentPassword
      );
      await user.reauthenticateWithCredential(credential);
      
      // Actualizar contraseña
      await user.updatePassword(validatedData.newPassword);
      
      return {
        success: true,
        message: 'Contraseña actualizada correctamente'
      };
    } catch (error) {
      request.log.error('Error en cambio de contraseña:', error);
      throw error;
    }
  }

  async updateProfile(request, reply) {
    try {
      const validatedData = updateProfileSchema.parse(request.body);
      
      // Actualizar perfil en Firebase Auth
      const updates = {};
      if (validatedData.username) {
        updates.displayName = validatedData.username;
      }
      if (validatedData.photoURL) {
        updates.photoURL = validatedData.photoURL;
      }
      
      if (Object.keys(updates).length > 0) {
        await auth.updateUser(request.user.uid, updates);
      }
      
      // Actualizar perfil en nuestra base de datos
      const userRef = db.collection('users').doc(request.user.uid);
      await userRef.update({
        username: validatedData.username,
        updatedAt: new Date()
      });
      
      return {
        success: true,
        user: validatedData
      };
    } catch (error) {
      request.log.error('Error en actualización de perfil:', error);
      throw error;
    }
  }

  async getProfile(request, reply) {
    try {
      const userRef = db.collection('users').doc(request.user.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return reply.code(404).send({
          error: 'Usuario no encontrado'
        });
      }

      const userData = userDoc.data();
      return {
        success: true,
        user: userData
      };
    } catch (error) {
      request.log.error('Error obteniendo perfil:', error);
      throw error;
    }
  }
}

module.exports = new AuthController();
