import { getLogger } from '../utils/logger.js';
import {
  createCollection,
  getUserCollections,
  addImageToCollection,
  removeImageFromCollection,
  getCollectionDetails
} from '../controllers/collections.js';

const logger = getLogger('Collections Routes', '');

export default async function collectionRoutes(fastify, opts) {
  // Crear nueva colección
  fastify.post('/api/collections', {
    preHandler: fastify.FBAuth,
    handler: createCollection
  });

  // Obtener colecciones del usuario
  fastify.get('/api/collections', {
    preHandler: fastify.FBAuth,
    handler: getUserCollections
  });

  // Obtener detalles de una colección
  fastify.get('/api/collections/:collectionId', {
    preHandler: fastify.FBAuth,
    handler: getCollectionDetails
  });

  // Agregar imagen a colección
  fastify.post('/api/collections/:collectionId/images/:imageId', {
    preHandler: fastify.FBAuth,
    handler: addImageToCollection
  });

  // Eliminar imagen de colección
  fastify.delete('/api/collections/:collectionId/images/:imageId', {
    preHandler: fastify.FBAuth,
    handler: removeImageFromCollection
  });
}
