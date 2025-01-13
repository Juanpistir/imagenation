const { auth, db } = require('../config/firebase.config');

async function routes(fastify, options) {
  // Middleware para verificar autenticación
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await auth.verifyIdToken(idToken);
          request.user = decodedToken;
          console.log('✅ Usuario autenticado:', decodedToken.email);
        } catch (error) {
          console.error('❌ Error verificando token:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error en middleware de autenticación:', error);
    }
  });

  // Login de usuario
  fastify.post('/api/auth/login', async (request, reply) => {
    console.log('🔵 [LOGIN] Iniciando proceso de login');
    try {
      const { email, password } = request.body;
      console.log('📝 [LOGIN] Email recibido:', email);

      // Verificar credenciales con Firebase Auth
      const userRecord = await auth.getUserByEmail(email);
      console.log('✅ [LOGIN] Usuario encontrado:', userRecord.uid);

      // Generar token personalizado
      console.log('🔄 [LOGIN] Generando token...');
      const token = await auth.createCustomToken(userRecord.uid);
      console.log('✅ [LOGIN] Token generado');

      // Obtener datos adicionales del usuario
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      const userData = userDoc.data() || {};

      console.log('✅ [LOGIN] Login exitoso');
      reply.send({
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          ...userData
        },
        token
      });
    } catch (error) {
      console.error('❌ [LOGIN] Error:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Registro de usuario
  fastify.post('/api/auth/register', async (request, reply) => {
    console.log('🔵 [REGISTER] Iniciando registro');
    try {
      const { email, password, name } = request.body;
      console.log('📝 [REGISTER] Datos recibidos:', { email, name });

      // Crear usuario en Firebase Auth
      console.log('🔄 [REGISTER] Creando usuario...');
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name
      });
      console.log('✅ [REGISTER] Usuario creado:', userRecord.uid);

      // Crear perfil en Firestore
      await db.collection('users').doc(userRecord.uid).set({
        name,
        email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ [REGISTER] Perfil creado en Firestore');

      // Generar token
      const token = await auth.createCustomToken(userRecord.uid);
      console.log('✅ [REGISTER] Token generado');

      reply.send({
        success: true,
        user: userRecord,
        token
      });
    } catch (error) {
      console.error('❌ [REGISTER] Error:', error);
      reply.code(400).send({ error: error.message });
    }
  });

  // Verificar sesión actual
  fastify.get('/api/auth/verify', async (request, reply) => {
    console.log('🔵 [VERIFY] Verificando sesión');
    try {
      if (!request.user) {
        throw new Error('No autenticado');
      }

      const userRecord = await auth.getUser(request.user.uid);
      const userDoc = await db.collection('users').doc(request.user.uid).get();
      const userData = userDoc.data() || {};

      console.log('✅ [VERIFY] Sesión válida para:', userRecord.email);
      reply.send({
        success: true,
        user: {
          ...userRecord,
          ...userData
        }
      });
    } catch (error) {
      console.error('❌ [VERIFY] Error:', error);
      reply.code(401).send({ error: error.message });
    }
  });

  // Cerrar sesión
  fastify.post('/api/auth/logout', async (request, reply) => {
    console.log('🔵 [LOGOUT] Cerrando sesión');
    try {
      if (request.user) {
        await auth.revokeRefreshTokens(request.user.uid);
        console.log('✅ [LOGOUT] Tokens revocados para:', request.user.email);
      }
      reply.send({ success: true });
    } catch (error) {
      console.error('❌ [LOGOUT] Error:', error);
      reply.code(400).send({ error: error.message });
    }
  });
}

module.exports = routes;
