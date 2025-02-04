import { getLogger } from '../utils/logger.js';
import { adminDb } from '../config/firebase.js';

const logger = getLogger('Collections Controller', '');

export async function createCollection(request, reply) {
  try {
    const { name, description = '' } = request.body;
    const userId = request.user.uid;

    logger.info('Creando colección:', { userId, name });

    if (!name?.trim()) {
      logger.error('Nombre de colección no proporcionado');
      return reply.code(400).send({ error: 'El nombre de la colección es requerido' });
    }

    const collectionData = {
      name: name.trim(),
      description: description.trim(),
      userId,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const collectionRef = await adminDb.collection('collections').add(collectionData);
    const newCollection = await collectionRef.get();

    logger.info('Colección creada:', { collectionId: collectionRef.id });

    return reply.code(201).send({
      id: newCollection.id,
      ...newCollection.data()
    });
  } catch (error) {
    logger.error('Error al crear colección:', error);
    return reply.code(500).send({ error: 'Error al crear la colección' });
  }
}

export async function getUserCollections(request, reply) {
  try {
    const userId = request.user.uid;
    logger.info('Obteniendo colecciones del usuario:', { userId });

    const collectionsSnapshot = await adminDb.collection('collections')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const collections = [];
    collectionsSnapshot.forEach(doc => {
      collections.push({
        id: doc.id,
        ...doc.data()
      });
    });

    logger.info(`Encontradas ${collections.length} colecciones`);
    return reply.send(collections);
  } catch (error) {
    logger.error('Error al obtener colecciones:', error);
    return reply.code(500).send({ error: 'Error al obtener las colecciones' });
  }
}

export async function getCollectionDetails(request, reply) {
  try {
    const { collectionId } = request.params;
    const userId = request.user.uid;

    logger.info('Obteniendo detalles de colección:', { collectionId, userId });

    const collectionRef = await adminDb.collection('collections').doc(collectionId).get();

    if (!collectionRef.exists) {
      logger.error('Colección no encontrada:', { collectionId });
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    const collection = collectionRef.data();

    if (collection.userId !== userId) {
      logger.error('Usuario no autorizado:', { userId, collectionId });
      return reply.code(403).send({ error: 'No autorizado' });
    }

    return reply.send({
      id: collectionRef.id,
      ...collection
    });
  } catch (error) {
    logger.error('Error al obtener detalles de colección:', error);
    return reply.code(500).send({ error: 'Error al obtener detalles de la colección' });
  }
}

export async function addImageToCollection(request, reply) {
  try {
    const { collectionId, imageId } = request.params;
    const userId = request.user.uid;

    logger.info('Agregando imagen a colección:', { collectionId, imageId, userId });

    const collectionRef = adminDb.collection('collections').doc(collectionId);
    const collection = await collectionRef.get();

    if (!collection.exists) {
      logger.error('Colección no encontrada:', { collectionId });
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    if (collection.data().userId !== userId) {
      logger.error('Usuario no autorizado:', { userId, collectionId });
      return reply.code(403).send({ error: 'No autorizado' });
    }

    await collectionRef.update({
      images: [...new Set([...collection.data().images, imageId])],
      updatedAt: new Date().toISOString()
    });

    logger.info('Imagen agregada exitosamente:', { collectionId, imageId });
    return reply.send({ message: 'Imagen agregada a la colección' });
  } catch (error) {
    logger.error('Error al agregar imagen:', error);
    return reply.code(500).send({ error: 'Error al agregar la imagen a la colección' });
  }
}

export async function removeImageFromCollection(request, reply) {
  try {
    const { collectionId, imageId } = request.params;
    const userId = request.user.uid;

    logger.info('Eliminando imagen de colección:', { collectionId, imageId, userId });

    const collectionRef = adminDb.collection('collections').doc(collectionId);
    const collection = await collectionRef.get();

    if (!collection.exists) {
      logger.error('Colección no encontrada:', { collectionId });
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    if (collection.data().userId !== userId) {
      logger.error('Usuario no autorizado:', { userId, collectionId });
      return reply.code(403).send({ error: 'No autorizado' });
    }

    await collectionRef.update({
      images: collection.data().images.filter(id => id !== imageId),
      updatedAt: new Date().toISOString()
    });

    logger.info('Imagen eliminada exitosamente:', { collectionId, imageId });
    return reply.send({ message: 'Imagen eliminada de la colección' });
  } catch (error) {
    logger.error('Error al eliminar imagen:', error);
    return reply.code(500).send({ error: 'Error al eliminar la imagen de la colección' });
  }
}
