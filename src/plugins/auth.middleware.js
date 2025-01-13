const fp = require('fastify-plugin');
const { auth } = require('../config/firebase.config');

async function authMiddleware(fastify, options) {
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.cookies.token; // Obtener token de las cookies
      console.log('Token recibido en middleware:', token);
      if (!token) throw new Error('No token provided');

      // Verificar el ID Token con Firebase
      const decodedToken = await auth.verifyIdToken(token);
      console.log('Token verificado:', decodedToken);
      
      // Obtener usuario completo
      const userRecord = await auth.getUser(decodedToken.uid);
      request.user = userRecord;
      request.userId = userRecord.uid;
      request.userRoles = decodedToken.roles || ['user'];
      console.log('Usuario autenticado:', userRecord.email);

    } catch (error) {
      console.error('Error en middleware de autenticación:', error.message);
      reply.code(401).send({ 
        error: 'Autenticación requerida',
        details: error.message 
      });
    }
  });

  // Middleware para verificar roles
  fastify.decorate('requireRoles', (roles) => {
    return async (request, reply) => {
      const userRoles = request.userRoles || ['user'];
      const hasRequiredRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        reply.code(403).send({ error: 'Permisos insuficientes' });
      }
    };
  });
}

module.exports = fp(authMiddleware, {
  name: 'authMiddleware',
  dependencies: ['@fastify/jwt']
});
