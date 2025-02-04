import { getLogger } from '../utils/logger.js';
import { adminDb } from '../config/firebase.js';

const logger = getLogger('Collections Controller', '');

async function getImageThumbnail(imageId) {
  const imageDoc = await adminDb.collection('images').doc(imageId).get();
  return imageDoc.exists ? imageDoc.data().imageUrl : null;
}

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
      updatedAt: new Date().toISOString(),
    };

    const collectionRef = await adminDb.collection('collections').add(collectionData);
    const newCollection = await collectionRef.get();

    logger.info('Colección creada:', { collectionId: collectionRef.id });

    return reply.code(201).send({
      id: newCollection.id,
      ...newCollection.data(),
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

    const collectionsSnapshot = await adminDb
      .collection('collections')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const collections = await Promise.all(
      collectionsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const thumbnail = data.images?.length > 0 ? await getImageThumbnail(data.images[0]) : null;
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          imagesCount: data.images?.length || 0,
          thumbnail,
        };
      })
    );

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
    const userId = request.user?.uid;

    if (!collectionId || !userId) {
      return reply.code(400).send({ error: 'Parámetros inválidos' });
    }

    const collectionRef = adminDb.collection('collections').doc(collectionId);
    const doc = await collectionRef.get();

    if (!doc.exists) {
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    const collection = doc.data();

    if (collection.userId !== userId) {
      return reply.code(403).send({ error: 'Acceso no autorizado' });
    }

    const collectionData = {
      id: doc.id,
      ...collection,
      createdAt: collection.createdAt?.toDate().toISOString(),
      updatedAt: collection.updatedAt?.toDate().toISOString(),
    };

    return reply.view('collection', {
      collection: collectionData,
      user: request.user,
      title: collection.name || 'Colección',
    });
  } catch (error) {
    logger.error('Error en getCollectionDetails:', error);
    return reply.code(500).send({
      error: 'Error del servidor',
      details: error.message,
    });
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
      updatedAt: new Date().toISOString(),
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
      images: collection.data().images.filter((id) => id !== imageId),
      updatedAt: new Date().toISOString(),
    });

    logger.info('Imagen eliminada exitosamente:', { collectionId, imageId });
    return reply.send({ message: 'Imagen eliminada de la colección' });
  } catch (error) {
    logger.error('Error al eliminar imagen:', error);
    return reply.code(500).send({ error: 'Error al eliminar la imagen de la colección' });
  }
}

export async function updateCollection(request, reply) {
  try {
    const { collectionId } = request.params;
    const { name, description } = request.body;
    const userId = request.user?.uid;

    if (!collectionId || !userId || !name?.trim()) {
      return reply.code(400).send({ error: 'Parámetros inválidos' });
    }

    const collectionRef = adminDb.collection('collections').doc(collectionId);
    const doc = await collectionRef.get();

    if (!doc.exists) {
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    const collection = doc.data();
    if (collection.userId !== userId) {
      return reply.code(403).send({ error: 'No tienes permiso para editar esta colección' });
    }

    const updateData = {
      name: name.trim(),
      description: description?.trim() || '',
      updatedAt: new Date().toISOString()
    };

    await collectionRef.update(updateData);
    
    const updatedDoc = await collectionRef.get();
    return reply.send({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    logger.error('Error al actualizar colección:', error);
    return reply.code(500).send({ error: 'Error al actualizar la colección' });
  }
}

export async function deleteCollection(request, reply) {
  try {
    const { collectionId } = request.params;
    const userId = request.user?.uid;

    if (!collectionId || !userId) {
      return reply.code(400).send({ error: 'Parámetros inválidos' });
    }

    const collectionRef = adminDb.collection('collections').doc(collectionId);
    const doc = await collectionRef.get();

    if (!doc.exists) {
      return reply.code(404).send({ error: 'Colección no encontrada' });
    }

    const collection = doc.data();
    if (collection.userId !== userId) {
      return reply.code(403).send({ error: 'No tienes permiso para eliminar esta colección' });
    }

    await collectionRef.delete();
    return reply.send({ message: 'Colección eliminada correctamente' });
  } catch (error) {
    logger.error('Error al eliminar colección:', error);
    return reply.code(500).send({ error: 'Error al eliminar la colección' });
  }
}
