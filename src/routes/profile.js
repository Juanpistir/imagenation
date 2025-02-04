import { getLogger } from '../utils/logger.js';
import {
  getProfile,
  updateProfile,
  getLikedImages,
  getCollections,
} from '../controllers/profile.js';

const logger = getLogger('Profile Routes', '');

export default async function profileRoutes(fastify, opts) {
  // Helper para registrar rutas con y sin prefijo /api
  const registerRoute = (method, path, handler, options = {}) => {
    const apiPath = `/api${path}`;
    const defaultOptions = { preHandler: fastify.FBAuth, ...options };

    // Registrar ruta con prefijo /api
    fastify[method](apiPath, defaultOptions, handler);
    // Registrar ruta sin prefijo
    fastify[method](path, defaultOptions, handler);
  };

  // Obtener perfil
  registerRoute('get', '/profile/:userId', getProfile);

  // Actualizar perfil
  registerRoute('put', '/profile/:userId', updateProfile);

  // Verificar disponibilidad de username
  registerRoute(
    'get',
    '/profile/check-username',
    async (request, reply) => {
      try {
        const { username } = request.query;
        const currentUser = request.user?.uid;

        if (!username) {
          logger.error('Username no proporcionado');
          return reply.code(400).send({ error: 'Username es requerido' });
        }

        // Buscar usuarios con el mismo username
        const usersRef = fastify.firebase.adminDb.collection('users');
        const snapshot = await usersRef.where('username', '==', username.toLowerCase()).get();

        // El username está disponible si:
        // 1. No hay resultados (nadie lo usa)
        // 2. El único resultado es el usuario actual (está verificando su propio username)
        const isAvailable =
          snapshot.empty ||
          (currentUser && snapshot.size === 1 && snapshot.docs[0].id === currentUser);

        logger.info(`Username ${username} disponibilidad:`, { isAvailable });

        return reply.send({ available: isAvailable });
      } catch (error) {
        logger.error('Error al verificar username:', error);
        return reply.code(500).send({ error: 'Error al verificar username' });
      }
    },
    { preHandler: [] }
  ); // No requerimos autenticación para esta ruta

  // Obtener imágenes con like
  fastify.get(
    '/profile/:userId/likes',
    {
      preHandler: [fastify.FBAuth],
    },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const currentUser = request.user;

        if (!userId) {
          logger.error('ID de usuario no proporcionado');
          return reply.code(400).send({ error: 'ID de usuario es requerido' });
        }

        // Verificar que el usuario existe
        const userDoc = await fastify.firebase.adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          logger.error(`Usuario no encontrado con ID: ${userId}`);
          return reply.code(404).send({ error: 'Usuario no encontrado' });
        }

        // Asignar el userId al request para que el controlador lo use
        request.params.userId = userId;
        return getLikedImages(request, reply);
      } catch (error) {
        logger.error('Error al obtener imágenes con like:', error);
        return reply.code(500).send({ error: 'Error al obtener imágenes con like' });
      }
    }
  );

  // Obtener colecciones
  fastify.get(
    '/profile/:userId/collections',
    {
      preHandler: [fastify.FBAuth],
    },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const currentUser = request.user;

        if (!userId) {
          logger.error('ID de usuario no proporcionado');
          return reply.code(400).send({ error: 'ID de usuario es requerido' });
        }

        // Verificar que el usuario existe
        const userDoc = await fastify.firebase.adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          logger.error(`Usuario no encontrado con ID: ${userId}`);
          return reply.code(404).send({ error: 'Usuario no encontrado' });
        }

        // Asignar el userId al request para que el controlador lo use
        request.params.userId = userId;
        return getCollections(request, reply);
      } catch (error) {
        logger.error('Error al obtener colecciones:', error);
        return reply.code(500).send({ error: 'Error al obtener colecciones' });
      }
    }
  );
}
