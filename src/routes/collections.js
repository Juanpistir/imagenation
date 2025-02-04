import { adminDb } from '../config/firebase.js';
import { getLogger } from '../utils/logger.js';
import {
  createCollection,
  getUserCollections,
  addImageToCollection,
  removeImageFromCollection,
  getCollectionDetails,
  updateCollection,
  deleteCollection,
} from '../controllers/collections.js';

const logger = getLogger('Collections Routes', '');

export default async function collectionRoutes(fastify, opts) {
  // Crear nueva colección
  fastify.post('/api/collections', {
    preHandler: fastify.FBAuth,
    handler: createCollection,
  });

  // Obtener colecciones del usuario
  fastify.get('/api/collections', {
    preHandler: fastify.FBAuth,
    handler: getUserCollections,
  });

  // Obtener detalles de una colección
  fastify.get('/api/collections/:collectionId', {
    preHandler: fastify.FBAuth,
    schema: {
      params: {
        type: 'object',
        required: ['collectionId'],
        properties: {
          collectionId: { type: 'string', pattern: '^[a-zA-Z0-9]{20}$' },
        },
      },
    },
    handler: getCollectionDetails,
  });

  // Agregar imagen a colección
  fastify.post('/api/collections/:collectionId/images/:imageId', {
    preHandler: fastify.FBAuth,
    handler: addImageToCollection,
  });

  // Eliminar imagen de colección
  fastify.delete('/api/collections/:collectionId/images/:imageId', {
    preHandler: fastify.FBAuth,
    handler: removeImageFromCollection,
  });

  // Actualizar colección
  fastify.put('/api/collections/:collectionId', {
    preHandler: fastify.FBAuth,
    handler: updateCollection,
  });

  // Eliminar colección
  fastify.delete('/api/collections/:collectionId', {
    preHandler: fastify.FBAuth,
    handler: deleteCollection,
  });

  // Vista detallada de colección
  fastify.get('/collections/:collectionId', {
    preHandler: fastify.FBAuth,
    handler: async (request, reply) => {
      try {
        logger.info('Obteniendo colección:', request.params.collectionId);

        const collectionDoc = await adminDb
          .collection('collections')
          .doc(request.params.collectionId)
          .get();

        if (!collectionDoc.exists) {
          logger.error('Colección no encontrada:', request.params.collectionId);
          return reply.code(404).send({ error: 'Colección no encontrada' });
        }

        const collection = collectionDoc.data();
        logger.info('Datos de la colección:', {
          name: collection.name,
          imagesCount: collection.images?.length || 0,
        });

        // Verificar si el usuario tiene acceso
        if (!request.user || collection.userId !== request.user.uid) {
          logger.error('Usuario sin permisos:', {
            userId: request.user?.uid,
            collectionUserId: collection.userId,
          });
          return reply.code(403).send({ error: 'No tienes permiso para ver esta colección' });
        }

        // Convertir timestamps de manera segura
        const formatTimestamp = (timestamp) => {
          if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toISOString();
          }
          return null;
        };

        // Cargar detalles de las imágenes
        logger.info('Iniciando carga de imágenes. Total a cargar:', collection.images?.length || 0);

        const images = await Promise.all(
          (collection.images || []).map(async (imageId) => {
            logger.info('Cargando imagen:', imageId);
            const imageDoc = await adminDb.collection('images').doc(imageId).get();
            if (!imageDoc.exists) {
              logger.warn('Imagen no encontrada:', imageId);
              return null;
            }
            const imageData = imageDoc.data();
            logger.info('Imagen cargada:', { id: imageId, title: imageData.title });
            return {
              id: imageId,
              imageUrl: imageData.imageUrl,
              title: imageData.title,
              description: imageData.description,
            };
          })
        );

        const validImages = images.filter((img) => img !== null);
        logger.info('Imágenes cargadas exitosamente:', {
          total: collection.images?.length || 0,
          valid: validImages.length,
          invalid: (collection.images?.length || 0) - validImages.length,
        });

        const collectionData = {
          id: collectionDoc.id,
          name: collection.name,
          description: collection.description,
          userId: collection.userId,
          images: validImages,
          createdAt: formatTimestamp(collection.createdAt),
          updatedAt: formatTimestamp(collection.updatedAt),
        };

        logger.info('Datos finales de la colección:', {
          name: collectionData.name,
          imagesCount: collectionData.images.length,
          hasImages: collectionData.images.length > 0,
        });

        return reply.renderWithContext('collection', {
          collection: collectionData,
          title: collection.name || 'Colección',
        });
      } catch (error) {
        logger.error('Error al obtener colección:', error);
        return reply.code(500).send({ error: 'Error al obtener la colección' });
      }
    },
  });
}
