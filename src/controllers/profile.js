import { getLogger } from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
import { normalizeUserData, prepareUserDataForClient } from '../utils/userUtils.js';

const logger = getLogger('Profile Controller', '');

export async function getProfile(request, reply) {
  try {
    const { userId } = request.params;
    logger.info('Obteniendo perfil para ID:', { userId });

    if (!userId) {
      logger.error('ID de usuario no proporcionado');
      return reply.code(400).send({ error: 'ID de usuario es requerido' });
    }

    // Obtener datos del usuario actual
    const currentUser = request.user;
    logger.info('Datos del usuario actual:', currentUser);

    // Verificar que el usuario existe
    const userDoc = await request.server.firebase.adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      logger.error(`Usuario no encontrado con ID: ${userId}`);
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }

    const userData = userDoc.data();
    logger.info('Datos del usuario:', userData);

    // Normalizar datos del usuario actual
    const currentUserData = normalizeUserData(request.user);
    logger.info('Datos normalizados del usuario actual:', currentUserData);

    // Obtener las imágenes del usuario con paginación
    const limit = 12; // Número de imágenes por página
    const lastImageDoc = request.query.lastImageId
      ? await request.server.firebase.adminDb
          .collection('images')
          .doc(request.query.lastImageId)
          .get()
      : null;

    let imagesQuery = request.server.firebase.adminDb
      .collection('images')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastImageDoc) {
      imagesQuery = imagesQuery.startAfter(lastImageDoc);
    }

    const imagesSnapshot = await imagesQuery.get();
    const lastVisible = imagesSnapshot.docs[imagesSnapshot.docs.length - 1];

    const images = imagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      mainImageUrl: doc.data().mainImageUrl,
      createdAt: doc.data().createdAt,
      likesCount: doc.data().likesCount || 0,
      likes: doc.data().likes || [],
    }));

    logger.info(`Se encontraron ${images.length} imágenes para el usuario`);

    // Preparar datos seguros para Alpine.js
    const profileData = {
      id: userDoc.id,
      ...userData,
      images: Array.isArray(images) ? images : [],
      isOwner: currentUserData?.uid === userDoc.id,
      hasMoreImages: images.length === limit,
      lastImageId: lastVisible?.id,
    };

    logger.info('Datos del perfil preparados para el cliente:', profileData);

    const serializedData = JSON.stringify(profileData).replace(/</g, '\\u003c');
    logger.info('Datos serializados:', serializedData);

    return reply.renderWithContext('profile.hbs', {
      profile: profileData,
      PROFILE_DATA: serializedData,
      user: currentUserData,
      error: null,
    });
  } catch (error) {
    logger.error('Error al obtener perfil:', error);
    return reply.renderWithContext('error.hbs', {
      error: 'Error interno del servidor',
      user: request.user,
      statusCode: 500,
    });
  }
}

// Verificar disponibilidad de username
export async function checkUsername(request, reply) {
  try {
    const { username } = request.query;
    const currentUserId = request.user?.uid;

    if (!username) {
      logger.error('Username no proporcionado');
      return reply.code(400).send({ error: 'Username es requerido' });
    }

    // Buscar usuarios con el mismo username
    const usersRef = request.server.firebase.adminDb.collection('users');
    const snapshot = await usersRef.where('username', '==', username.toLowerCase()).get();

    // El username está disponible si:
    // 1. No hay resultados (nadie lo usa)
    // 2. El único resultado es el usuario actual (está verificando su propio username)
    const isAvailable =
      snapshot.empty ||
      (currentUserId && snapshot.size === 1 && snapshot.docs[0].id === currentUserId);

    logger.info(`Username ${username} disponibilidad:`, { isAvailable });

    return reply.send({ available: isAvailable });
  } catch (error) {
    logger.error('Error al verificar username:', error);
    return reply.code(500).send({ error: 'Error al verificar username' });
  }
}

export async function updateProfile(request, reply) {
  try {
    const { userId } = request.params;
    const currentUser = request.user;
    logger.info('🔍 Iniciando actualización de perfil:', { userId, currentUser });

    if (!currentUser || currentUser.uid !== userId) {
      logger.error('❌ Usuario no autorizado para actualizar este perfil');
      return reply.code(403).send({ error: 'No autorizado para actualizar este perfil' });
    }

    // Verificar si es una petición multipart o JSON
    const contentType = request.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    logger.info('📝 Tipo de contenido:', { contentType, isMultipart });

    let formData = {};

    if (isMultipart) {
      logger.info('📦 Procesando datos multipart');
      const parts = await request.parts();

      for await (const part of parts) {
        logger.info('📄 Procesando parte:', {
          type: part.type,
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
        });

        if (part.type === 'field') {
          formData[part.fieldname] = part.value;
        } else if (part.fieldname === 'photo' || part.fieldname === 'banner') {
          formData[part.fieldname] = part;
        }
      }
    } else {
      logger.info('📦 Procesando datos JSON:', request.body);
      formData = request.body;
    }

    logger.info('📝 Datos del formulario procesados:', {
      ...formData,
      photo: formData.photo ? 'Buffer presente' : 'No hay foto',
      banner: formData.banner ? 'Buffer presente' : 'No hay banner',
    });

    // Validar campos requeridos
    if (!formData.displayName || !formData.username) {
      logger.error('❌ Campos requeridos faltantes:', { formData });
      return reply.code(400).send({ error: 'Nombre y username son requeridos' });
    }

    const allowedUpdates = ['displayName', 'username', 'biography'];
    const updateData = {};

    for (const field of allowedUpdates) {
      if (formData[field] !== undefined && formData[field] !== null) {
        updateData[field] = formData[field];
      }
    }

    logger.info('📝 Datos a actualizar:', updateData);

    if (updateData.username) {
      logger.info('🔍 Verificando disponibilidad de username:', updateData.username);
      const usernameCheck = await request.server.firebase.adminDb
        .collection('users')
        .where('username', '==', updateData.username.toLowerCase())
        .get();

      if (!usernameCheck.empty && usernameCheck.docs[0].id !== userId) {
        logger.error('❌ Username no disponible');
        return reply.code(400).send({ error: 'Username no disponible' });
      }

      updateData.username = updateData.username.toLowerCase();
    }

    // Procesar foto de perfil si existe
    if (formData.photo) {
      try {
        logger.info('📸 Procesando foto de perfil');
        const buffer = isMultipart ? await formData.photo.toBuffer() : Buffer.from(formData.photo);

        logger.info('📸 Buffer de foto creado, tamaño:', buffer.length);

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'avatars',
              width: 400,
              height: 400,
              crop: 'fill',
              gravity: 'face',
            },
            (error, result) => {
              if (error) {
                logger.error('❌ Error en Cloudinary:', error);
                reject(error);
              } else {
                logger.info('✅ Foto subida a Cloudinary:', result);
                resolve(result);
              }
            }
          );

          logger.info('📤 Enviando buffer a Cloudinary');
          uploadStream.end(buffer);
        });

        updateData.photoURL = result.secure_url;
        logger.info('✅ URL de foto actualizada:', result.secure_url);
      } catch (error) {
        logger.error('❌ Error al subir foto de perfil:', error);
        return reply.code(500).send({ error: 'Error al subir foto de perfil' });
      }
    }

    // Procesar banner si existe
    if (formData.banner) {
      try {
        logger.info('🖼️ Procesando banner');
        const buffer = isMultipart
          ? await formData.banner.toBuffer()
          : Buffer.from(formData.banner);

        logger.info('🖼️ Buffer de banner creado, tamaño:', buffer.length);

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'banners',
              width: 1200,
              height: 400,
              crop: 'fill',
            },
            (error, result) => {
              if (error) {
                logger.error('❌ Error en Cloudinary:', error);
                reject(error);
              } else {
                logger.info('✅ Banner subido a Cloudinary:', result);
                resolve(result);
              }
            }
          );

          logger.info('📤 Enviando buffer a Cloudinary');
          uploadStream.end(buffer);
        });

        updateData.bannerURL = result.secure_url;
        logger.info('✅ URL de banner actualizada:', result.secure_url);
      } catch (error) {
        logger.error('❌ Error al subir banner:', error);
        return reply.code(500).send({ error: 'Error al subir banner' });
      }
    }

    // Actualizar perfil en Firebase
    logger.info('🔄 Actualizando perfil en Firebase:', updateData);
    const userRef = request.server.firebase.adminDb.collection('users').doc(userId);
    await userRef.update(updateData);

    // Obtener datos actualizados
    const updatedDoc = await userRef.get();
    const userData = updatedDoc.data();

    // Preparar datos para la respuesta
    const responseData = {
      ...userData,
      id: updatedDoc.id,
    };

    logger.info('✅ Perfil actualizado exitosamente:', responseData);

    return reply.code(200).send({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: responseData,
    });
  } catch (error) {
    logger.error('❌ Error al actualizar perfil:', error);
    return reply.code(500).send({ error: 'Error al actualizar perfil' });
  }
}

export async function getLikedImages(request, reply) {
  try {
    const { userId } = request.params;

    if (!userId) {
      logger.error('ID de usuario no proporcionado');
      return reply.code(400).send({ error: 'ID de usuario es requerido' });
    }

    const likesRef = await request.server.firebase.adminDb
      .collection('likes')
      .where('userId', '==', userId)
      .get();

    const likes = [];
    const imagePromises = likesRef.docs.map(async (likeDoc) => {
      const likeData = likeDoc.data();
      const imageDoc = await request.server.firebase.adminDb
        .collection('images')
        .doc(likeData.imageId)
        .get();

      if (!imageDoc.exists) {
        logger.warn(`Imagen ${likeData.imageId} no encontrada para el like ${likeDoc.id}`);
        return null;
      }

      return {
        id: imageDoc.id,
        ...imageDoc.data(),
        likeId: likeDoc.id,
      };
    });

    const likedImages = (await Promise.all(imagePromises)).filter(Boolean);

    logger.info(`Obtenidas ${likedImages.length} imágenes con like para el usuario ${userId}`);
    return reply.send({ likes: likedImages });
  } catch (error) {
    logger.error('Error al obtener imágenes con like:', error);
    return reply.code(500).send({ error: 'Error al obtener imágenes con like' });
  }
}

export async function getCollections(request, reply) {
  try {
    const { userId } = request.params;

    if (!userId) {
      logger.error('ID de usuario no proporcionado');
      return reply.code(400).send({ error: 'ID de usuario es requerido' });
    }

    const collectionsRef = await request.server.firebase.adminDb
      .collection('collections')
      .where('userId', '==', userId)
      .get();

    const collections = [];

    for (const doc of collectionsRef.docs) {
      const collection = { id: doc.id, ...doc.data() };

      // Si la colección tiene imágenes, obtener sus URLs
      if (collection.images && collection.images.length > 0) {
        const imagePromises = collection.images.map(async (imageId) => {
          const imageDoc = await request.server.firebase.adminDb
            .collection('images')
            .doc(imageId)
            .get();

          if (imageDoc.exists) {
            return {
              id: imageDoc.id,
              ...imageDoc.data(),
            };
          }
          return null;
        });

        const images = await Promise.all(imagePromises);
        collection.images = images.filter((img) => img !== null);
      }

      collections.push(collection);
    }

    logger.info(`Obtenidas ${collections.length} colecciones con sus imágenes`);
    return reply.send({ collections });
  } catch (error) {
    logger.error('Error al obtener colecciones:', error);
    return reply.code(500).send({ error: 'Error al obtener colecciones' });
  }
}
