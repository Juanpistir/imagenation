const { auth } = require('../config/firebase.config');
const UserModel = require('../models/user');
const fastifyPlugin = require('fastify-plugin');

async function routes(fastify, options) {
  const ratelimitConfig = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes'
      }
    }
  };

  // Aplicar rate limit solo a rutas de autenticación
  fastify.post('/auth/login', ratelimitConfig, async (request, reply) => {
    try {
      const { idToken } = request.body;

      if (!idToken) {
        return reply.code(400).send({ error: 'Token de autenticación requerido' });
      }

      // Verificar el ID Token con Firebase
      const decodedToken = await auth.verifyIdToken(idToken);
      const { uid, email, name } = decodedToken;

      // Buscar o crear el usuario en Firestore
      let user = await UserModel.findById(uid);
      if (!user) {
        user = await UserModel.create({
          uid,
          email,
          username: name || 'Usuario'
        });
      }

      // Generar un token personalizado para el servidor (opcional)
      // const serverToken = fastify.jwt.sign({ uid: user.uid, roles: user.roles });

      // Establecer el token en una cookie HTTP-only
      reply.setCookie('token', idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      return { message: 'Inicio de sesión exitoso' };
    } catch (error) {
      console.error('Error en /auth/login:', error);
      reply.code(401).send({ error: 'Autenticación fallida', details: error.message });
    }
  });

  fastify.post('/auth/register', ratelimitConfig, async (request, reply) => {
    try {
      const { email, password, username } = request.body;

      // Verificar si el usuario ya existe
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return reply.code(400).send({ 
          error: 'Registro fallido',
          details: 'El email ya está registrado' 
        });
      }

      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: username
      }).catch(error => {
        console.error('Error Firebase Auth:', error);
        throw error;
      });

      // Crear usuario en Firestore
      const user = await UserModel.create({
        uid: userRecord.uid,
        email,
        username
      });

      // Obtener el token personalizado de Firebase
      const idToken = await auth.createCustomToken(user.uid);

      // Establecer el token en una cookie HTTP-only
      reply.setCookie('token', idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      return { message: 'Registro exitoso' };
    } catch (error) {
      console.error('Error en /auth/register:', error);
      reply.code(400).send({ 
        error: 'Registro fallido',
        details: error.message 
      });
    }
  });

  fastify.post('/auth/logout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Revocar tokens de refresh en Firebase
      await auth.revokeRefreshTokens(request.userId);

      // Eliminar la cookie del token
      reply.clearCookie('token', { path: '/' });

      return { message: 'Cierre de sesión exitoso' };
    } catch (error) {
      console.error('Error en /auth/logout:', error);
      reply.code(500).send({ error: 'Error al cerrar sesión', details: error.message });
    }
  });

  // Rutas sin rate limit
  fastify.get('/auth/google', async (request, reply) => {
    return reply.view('auth/google-redirect');
  });

  fastify.post('/auth/google', async (request, reply) => {
    try {
      const { idToken } = request.body;

      if (!idToken) {
        return reply.code(400).send({ error: 'Token de Google requerido' });
      }

      // Verificar el token de Google
      const decodedToken = await auth.verifyIdToken(idToken);
      const { email, name, picture, uid } = decodedToken;

      // Buscar o crear usuario
      let user = await UserModel.findById(uid);
      if (!user) {
        user = await UserModel.create({
          uid,
          email,
          username: name || 'Usuario',
          profilePicture: picture,
          authProvider: 'google'
        });
      }

      // Establecer el token en una cookie HTTP-only
      reply.setCookie('token', idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      return { message: 'Autenticación con Google exitosa' };
    } catch (error) {
      console.error('Error en /auth/google:', error);
      reply.code(400).send({ 
        error: 'Autenticación con Google fallida',
        details: error.message 
      });
    }
  });
}

module.exports = fp(routes, {
  name: 'authRoutes',
  dependencies: ['@fastify/jwt']
});
