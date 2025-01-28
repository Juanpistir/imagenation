import { 
  getProfile, 
  checkUsername, 
  updateProfile,
  getLikedImages,
  getCollections
} from '../controllers/profile.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('Profile Routes', '');

export default async function profileRoutes(fastify, options) {
  // Verificar username (sin autenticación requerida)
  fastify.get('/profile/check-username', async (request, reply) => {
    try {
      // Si hay un token válido, adjuntar el usuario
      try {
        await fastify.FBAuth(request, reply);
      } catch (error) {
        // Ignorar errores de autenticación
        logger.info('Usuario no autenticado para verificación de username');
      }
      return checkUsername(request, reply);
    } catch (error) {
      logger.error('Error en ruta check-username:', error);
      return reply.code(500).send({ error: 'Error al verificar username' });
    }
  });

  // Obtener perfil por ID
  fastify.get('/profile/:id', {
    onRequest: [fastify.FBAuth]
  }, async (request, reply) => {
    return getProfile(request, reply);
  });

  // Actualizar perfil
  fastify.put('/profile/:id', {
    onRequest: [fastify.FBAuth]
  }, async (request, reply) => {
    return updateProfile(request, reply);
  });

  // Obtener imágenes que le gustan al usuario
  fastify.get('/profile/:username/likes', {
    onRequest: [fastify.FBAuth]
  }, async (request, reply) => {
    try {
      return getLikedImages(request, reply);
    } catch (error) {
      logger.error('Error al obtener imágenes con like:', error);
      return reply.code(500).send({ error: 'Error al obtener imágenes con like' });
    }
  });

  // Obtener colecciones del usuario
  fastify.get('/profile/:username/collections', {
    onRequest: [fastify.FBAuth]
  }, async (request, reply) => {
    try {
      return getCollections(request, reply);
    } catch (error) {
      logger.error('Error al obtener colecciones:', error);
      return reply.code(500).send({ error: 'Error al obtener colecciones' });
    }
  });
}
