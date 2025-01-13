const imageController = require('../controllers/image');

async function imageRoutes(fastify, options) {
  // Middleware de autenticación
  const authenticateUser = async (request, reply) => {
    try {
      if (!request.headers.authorization) {
        throw new Error('No token provided');
      }

      const token = request.headers.authorization.split(' ')[1];
      const decodedToken = await fastify.firebase.auth().verifyIdToken(token);
      request.user = decodedToken;
    } catch (error) {
      reply.status(401).send({ error: 'Por favor inicia sesión para continuar' });
    }
  };

  // Rutas específicas primero
  fastify.get('/search', imageController.searchImages);
  
  // Rutas con parámetros después
  fastify.get('/:id', imageController.getImage);
  
  // Ruta para subir imágenes (protegida)
  fastify.post('/', {
    preHandler: [
      authenticateUser,
      async (request, reply) => {
        if (!request.isMultipart()) {
          return reply.code(400).send({ error: 'Request is not multipart' });
        }
      }
    ]
  }, imageController.createImage);
  
  // Otras rutas protegidas
  fastify.post('/:image_id/like', { preHandler: authenticateUser }, imageController.likeImage);
  fastify.post('/:image_id/comment', { preHandler: authenticateUser }, imageController.commentImage);
  fastify.delete('/:image_id', { preHandler: authenticateUser }, imageController.deleteImage);
}

module.exports = imageRoutes;
