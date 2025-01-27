import { getLogger } from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
import { adminDb } from '../config/firebase.js';
import { normalizeUserData } from '../utils/userUtils.js';

const logger = getLogger('Image Controller', '');

export const getImage = async (request, reply) => {
  try {
    const { id } = request.params;

    if (!id) {
      logger.error('ID de imagen no proporcionado');
      return reply.code(400).send({ error: 'ID de imagen es requerido' });
    }

    // Obtener la imagen de Firestore
    const imageDoc = await adminDb.collection('images').doc(id).get();

    if (!imageDoc.exists) {
      logger.error(`Imagen no encontrada con ID: ${id}`);
      return reply.code(404).send({ error: 'Imagen no encontrada' });
    }

    const imageData = imageDoc.data();

    // Obtener el usuario que subió la imagen
    const userDoc = await adminDb.collection('users').doc(imageData.userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Obtener comentarios de la imagen
    const commentsSnapshot = await adminDb
      .collection('images')
      .doc(id)
      .collection('comments')
      .orderBy('timestamp', 'desc')
      .get();

    const comments = commentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Obtener likes de la imagen
    const likesSnapshot = await adminDb.collection('likes').where('imageId', '==', id).get();

    const likes = likesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Incrementar contador de vistas
    await adminDb
      .collection('images')
      .doc(id)
      .update({
        views: (imageData.views || 0) + 1,
        lastViewedAt: new Date(),
      });

    // Normalizar datos del usuario actual
    const currentUserData = normalizeUserData(request.user);

    // Construir objeto de respuesta
    const image = {
      id,
      ...imageData,
      userEmail: userData?.email || 'Usuario desconocido',
      comments,
      likes: Array.isArray(imageData.likes) ? imageData.likes.length : 0,
      hasLiked: Array.isArray(imageData.likes) && imageData.likes.includes(request.user?.uid),
      isAuthenticated: !!request.user,
      user: currentUserData,
    };

    // Renderizar la vista con los datos usando renderWithContext
    return reply.renderWithContext('image', {
      image,
      user: currentUserData,
      error: null,
    });
  } catch (error) {
    logger.error('Error obteniendo imagen:', error);
    return reply.code(500).send({
      error: 'Error al obtener la imagen',
      details: error.message,
    });
  }
};

export const uploadImage = async (request, reply) => {
  let file;
  const fields = {};

  try {
    // 1. Procesar todas las partes del formulario en un solo ciclo
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        file = part;
        logger.info('Archivo recibido:', {
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
        });
        // Guardar el buffer del archivo
        const chunks = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        file.buffer = Buffer.concat(chunks);
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
        // Log solo los campos no sensibles
        if (!['password', 'token', 'apiKey'].includes(part.fieldname)) {
          logger.info(`Campo recibido: ${part.fieldname}`);
        }
      }
    }

    // 2. Validaciones
    if (!fields.title?.trim()) {
      logger.error('No se proporcionó un título');
      return reply.code(400).send({ error: 'El título es requerido' });
    }

    if (!file || !file.buffer) {
      logger.error('No se proporcionó ninguna imagen');
      return reply.code(400).send({ error: 'La imagen es requerida' });
    }

    // 3. Subir imagen a Cloudinary usando el buffer
    logger.info('Iniciando subida a Cloudinary...');
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'imagenation',
          transformation: [{ width: 800, crop: 'scale' }, { quality: 'auto' }],
        },
        (error, result) => {
          if (error) {
            logger.error('Error en Cloudinary:', {
              error: error.message,
              code: error.http_code,
            });
            reject(error);
            return;
          }
          logger.info('Subida a Cloudinary exitosa', {
            publicId: result.public_id,
            format: result.format,
            size: result.bytes,
          });
          resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });

    // 4. Guardar metadatos en Firestore
    const imageData = {
      title: fields.title.trim(),
      description: fields.description?.trim() || '',
      title_lower: fields.title.trim().toLowerCase(),
      description_lower: (fields.description?.trim() || '').toLowerCase(),
      tags: fields.tags
        ? fields.tags
            .toLowerCase()
            .split(',')
            .map((tag) => tag.trim())
        : [],
      mainImageUrl: cloudinaryResult.secure_url,
      imageUrl: cloudinaryResult.secure_url,
      mainImageId: cloudinaryResult.public_id,
      userId: request.user.uid,
      createdAt: new Date(),
      timestamp: new Date(),
      lastViewedAt: new Date(),
      views: 0,
      isPublic: true,
      metadata: {
        format: cloudinaryResult.format,
        height: cloudinaryResult.height,
        width: cloudinaryResult.width,
        originalName: fields.title.trim(),
      },
    };

    logger.info('Guardando metadatos en Firestore...', {
      title: imageData.title,
      userId: imageData.userId,
      format: imageData.metadata.format,
    });

    const docRef = await adminDb.collection('images').add(imageData);

    logger.info('Imagen procesada exitosamente', {
      imageId: docRef.id,
      title: imageData.title,
    });

    // 5. Respuesta exitosa
    reply.send({
      success: true,
      id: docRef.id,
      imageUrl: imageData.mainImageUrl,
      title: imageData.title,
      description: imageData.description,
    });
  } catch (error) {
    logger.error('Error en el proceso de subida:', {
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    reply.code(500).send({
      error: 'Error al subir la imagen',
      details: error.message,
    });
  }
};

export const deleteImage = async (request, reply) => {
  const logger = getLogger('Delete Image Controller');

  try {
    const userId = request.user?.uid;
    if (!userId) {
      logger.warn('Intento de eliminación sin autenticación');
      return reply.code(401).send({ error: 'No autorizado' });
    }

    const imageId = request.params.id;
    if (!imageId) {
      logger.warn('Intento de eliminación sin ID de imagen');
      return reply.code(400).send({ error: 'ID de imagen requerido' });
    }

    logger.info(`Iniciando eliminación de imagen ${imageId} por usuario ${userId}`);

    const imageRef = adminDb.collection('images').doc(imageId);
    const doc = await imageRef.get();

    if (!doc.exists) {
      logger.warn(`Imagen ${imageId} no encontrada`);
      return reply.code(404).send({ error: 'Imagen no encontrada' });
    }

    const imageData = doc.data();

    if (imageData.userId !== userId) {
      logger.warn(`Usuario ${userId} intentó eliminar imagen ${imageId} de otro usuario`);
      return reply.code(403).send({ error: 'No tienes permiso para esta acción' });
    }

    // Eliminar comentarios asociados
    const commentsSnapshot = await adminDb
      .collection('comments')
      .where('imageId', '==', imageId)
      .get();

    const batch = adminDb.batch();
    commentsSnapshot.docs.forEach((commentDoc) => {
      batch.delete(commentDoc.ref);
    });

    // Eliminar likes asociados
    const likesSnapshot = await adminDb.collection('likes').where('imageId', '==', imageId).get();

    likesSnapshot.docs.forEach((likeDoc) => {
      batch.delete(likeDoc.ref);
    });

    if (imageData.mainImageId) {
      try {
        await cloudinary.uploader.destroy(imageData.mainImageId);
        logger.info(`Imagen eliminada de Cloudinary: ${imageData.mainImageId}`);
      } catch (cloudinaryError) {
        logger.error('Error eliminando de Cloudinary:', cloudinaryError);
        if (cloudinaryError.http_code !== 404) {
          throw cloudinaryError;
        }
      }
    }

    // Eliminar el documento de la imagen y ejecutar el batch
    batch.delete(imageRef);
    await batch.commit();

    logger.info(`Imagen ${imageId} y sus relaciones eliminadas exitosamente`);

    reply.send({
      success: true,
      message: 'Imagen y contenido relacionado eliminados correctamente',
      deletedId: imageId,
      redirectUrl: '/',
    });
  } catch (error) {
    logger.error('Error eliminando imagen:', error);

    if (error.http_code === 404) {
      return reply.code(404).send({
        error: 'Imagen no encontrada en Cloudinary',
        details: error.message,
      });
    }

    reply.code(500).send({
      error: 'Error al eliminar la imagen',
      details: error.message,
    });
  }
};

export const searchImages = async (request, reply) => {
  try {
    const { query } = request.query;

    // Validación de la consulta
    if (!query?.trim() || query.length < 3) {
      return reply.status(400).send({
        error: 'La búsqueda requiere al menos 3 caracteres',
      });
    }

    const searchQuery = query.toLowerCase().trim();
    const imagesRef = adminDb.collection('images');

    // Búsqueda principal
    const snapshot = await imagesRef.where('isPublic', '==', true).get();

    const results = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const tags = (data.tags || []).map((tag) => tag.toLowerCase());

      // Calcular score basado en dónde se encuentra la coincidencia
      let score = 0;

      // Coincidencia en título
      if (title.includes(searchQuery)) {
        // Mayor score si está al inicio del título
        score += title.startsWith(searchQuery) ? 4 : 3;
      }

      // Coincidencia en tags
      if (tags.some((tag) => tag.includes(searchQuery))) {
        score += 2;
      }

      // Coincidencia en descripción
      if (description.includes(searchQuery)) {
        score += 1;
      }

      // Si hay alguna coincidencia, agregar a resultados
      if (score > 0) {
        const thumbnail = data.thumbnail || data.mainImageUrl;
        results.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          mainImageUrl: data.mainImageUrl,
          thumbnail: thumbnail,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          relevanceScore: score,
        });
      }
    });

    // Ordenar por relevancia y fecha
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.timestamp - a.timestamp;
    });

    reply.send({ images: results.slice(0, 20) });
  } catch (error) {
    console.error('Search Error:', error);
    reply.status(500).send({
      error: 'Error al realizar la búsqueda',
    });
  }
};

export const updateImage = async (request, reply) => {
  try {
    const { id } = request.params;
    const { title, description } = request.body;

    // Validación básica
    if (!title?.trim()) {
      logger.error('Título requerido para actualizar imagen');
      return reply.code(400).send({ error: 'El título es requerido' });
    }

    // Verificar existencia y propiedad de la imagen
    const doc = await adminDb.collection('images').doc(id).get();
    if (!doc.exists) {
      logger.error(`Imagen no encontrada con ID: ${id}`);
      return reply.code(404).send({ error: 'Imagen no encontrada' });
    }

    if (doc.data().userId !== request.user.uid) {
      logger.error(`Usuario ${request.user.uid} intentó editar imagen que no le pertenece: ${id}`);
      return reply.code(403).send({ error: 'No tienes permiso para editar esta imagen' });
    }

    // Actualizar la imagen
    await adminDb
      .collection('images')
      .doc(id)
      .update({
        title: title.trim(),
        description: description?.trim() || '',
        updatedAt: new Date().toISOString(),
      });

    logger.info(`Imagen ${id} actualizada exitosamente por usuario ${request.user.uid}`);
    reply.send({ success: true });
  } catch (error) {
    logger.error('Error actualizando imagen:', error);
    reply.code(500).send({ error: 'Error al actualizar la imagen' });
  }
};

export const toggleLike = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user?.uid;

    if (!id || !userId) {
      logger.error('Datos incompletos para like:', { id, userId });
      return reply.code(400).send({ error: 'Datos incompletos' });
    }

    const imageRef = adminDb.collection('images').doc(id);

    // Usar transacción para evitar condiciones de carrera
    const result = await adminDb.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);

      if (!imageDoc.exists) {
        throw new Error('Imagen no encontrada');
      }

      const imageData = imageDoc.data();
      // Asegurar que likes sea un array válido
      const likes = Array.isArray(imageData.likes) ? imageData.likes : [];

      // Validar que todos los likes sean strings
      const validLikes = likes.filter((id) => typeof id === 'string');
      const hasLiked = validLikes.includes(userId);

      const newLikes = hasLiked
        ? validLikes.filter((id) => id !== userId)
        : [...validLikes, userId];

      transaction.update(imageRef, {
        likes: newLikes,
        lastModified: new Date(),
      });

      return {
        success: true,
        newLikesCount: newLikes.length,
        hasLiked: !hasLiked,
      };
    });

    reply.send(result);
  } catch (error) {
    logger.error('Error al dar like:', error);
    if (error.message === 'Imagen no encontrada') {
      return reply.code(404).send({ error: error.message });
    }
    reply.code(500).send({ error: 'Error del servidor' });
  }
};

export const addComment = async (request, reply) => {
  const logger = getLogger('Add Comment Controller');

  try {
    const { text } = request.body;
    const { id: imageId } = request.params;
    const userId = request.user?.uid;
    const userEmail = request.user?.email;

    if (!text?.trim()) {
      logger.warn('Intento de comentar sin texto');
      return reply.code(400).send({ error: 'El texto del comentario es requerido' });
    }

    if (!imageId) {
      logger.warn('Intento de comentar sin ID de imagen');
      return reply.code(400).send({ error: 'ID de imagen es requerido' });
    }

    // Verificar que la imagen existe
    const imageRef = adminDb.collection('images').doc(imageId);
    const imageDoc = await imageRef.get();

    if (!imageDoc.exists) {
      logger.warn(`Imagen ${imageId} no encontrada`);
      return reply.code(404).send({ error: 'Imagen no encontrada' });
    }

    // Crear el comentario
    const commentData = {
      text: text.trim(),
      userId,
      userEmail,
      imageId,
      timestamp: new Date(),
    };

    const commentRef = await imageRef.collection('comments').add(commentData);
    const comment = await commentRef.get();

    logger.info(`Comentario creado exitosamente: ${commentRef.id}`);

    return reply.send({
      id: commentRef.id,
      ...comment.data(),
    });
  } catch (error) {
    logger.error('Error al crear comentario:', error);
    return reply.code(500).send({ error: 'Error al crear el comentario' });
  }
};

export const deleteComment = async (request, reply) => {
  const logger = getLogger('Delete Comment Controller');

  try {
    const { id: imageId, commentId } = request.params;
    const userId = request.user?.uid;

    if (!imageId || !commentId) {
      logger.warn('ID de imagen o comentario no proporcionado');
      return reply.code(400).send({ error: 'IDs de imagen y comentario son requeridos' });
    }

    // Verificar que la imagen existe
    const imageRef = adminDb.collection('images').doc(imageId);
    const imageDoc = await imageRef.get();

    if (!imageDoc.exists) {
      logger.warn(`Imagen ${imageId} no encontrada`);
      return reply.code(404).send({ error: 'Imagen no encontrada' });
    }

    // Verificar que el comentario existe y pertenece al usuario
    const commentRef = imageRef.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      logger.warn(`Comentario ${commentId} no encontrado`);
      return reply.code(404).send({ error: 'Comentario no encontrado' });
    }

    const commentData = commentDoc.data();

    // Solo el autor del comentario o el dueño de la imagen puede eliminarlo
    if (commentData.userId !== userId && imageDoc.data().userId !== userId) {
      logger.warn(`Usuario ${userId} intentó eliminar comentario ${commentId} sin autorización`);
      return reply.code(403).send({ error: 'No tienes permiso para eliminar este comentario' });
    }

    await commentRef.delete();
    logger.info(`Comentario ${commentId} eliminado exitosamente`);

    return reply.send({ success: true });
  } catch (error) {
    logger.error('Error al eliminar comentario:', error);
    return reply.code(500).send({ error: 'Error al eliminar el comentario' });
  }
};
