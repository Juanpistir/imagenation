import { getLogger } from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
import { adminDb } from '../config/firebase.js';
import { normalizeUserData, prepareUserDataForClient } from '../utils/userUtils.js';

const logger = getLogger('Profile Controller', '');

export const getProfile = async (request, reply) => {
  try {
    const { id } = request.params;
    logger.info('Obteniendo perfil para ID:', id);
    logger.info('Datos del usuario actual:', request.user);

    if (!id) {
      logger.error('ID de usuario no proporcionado');
      return reply.code(400).send({ error: 'ID de usuario es requerido' });
    }

    // Obtener el perfil del usuario de Firestore
    const userDoc = await adminDb.collection('users').doc(id).get();
    logger.info('Datos obtenidos de Firestore:', {
      exists: userDoc.exists,
      id: userDoc.id,
    });

    if (!userDoc.exists) {
      logger.error(`Usuario no encontrado con ID: ${id}`);
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
      ? await adminDb.collection('images').doc(request.query.lastImageId).get()
      : null;

    let imagesQuery = adminDb
      .collection('images')
      .where('userId', '==', id)
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
};

// Verificar disponibilidad de username
export const checkUsername = async (request, reply) => {
  try {
    const { username } = request.query;
    const currentUserId = request.user?.uid; // Hacer opcional el uid del usuario

    if (!username) {
      logger.error('Username no proporcionado');
      return reply.code(400).send({ error: 'Username es requerido' });
    }

    // Buscar usuarios con el mismo username
    const usersRef = adminDb.collection('users');
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
};

export const updateProfile = async (request, reply) => {
  try {
    const { id } = request.params;

    // Verificar que el usuario autenticado sea el mismo que se intenta actualizar
    if (request.user.uid !== id) {
      logger.error('Usuario no autorizado para actualizar este perfil');
      return reply.code(403).send({ error: 'No autorizado para actualizar este perfil' });
    }

    // Obtener los campos del form data
    const formData = {};

    // Procesar los campos del formulario
    const fields = await request.parts();

    for await (const part of fields) {
      if (part.type === 'field') {
        formData[part.fieldname] = part.value;
      } else {
        // Si es un archivo, guardarlo para procesarlo después
        if (part.fieldname === 'photo' || part.fieldname === 'banner') {
          formData[part.fieldname] = part;
        }
      }
    }

    // Validar los campos actualizables
    const allowedUpdates = ['displayName', 'username', 'bio'];
    const updateData = {};

    // Procesar los campos de texto
    for (const field of allowedUpdates) {
      if (formData[field] !== undefined && formData[field] !== null) {
        updateData[field] = formData[field];
      }
    }

    // Si se incluye username, verificar que esté disponible
    if (updateData.username) {
      const usernameCheck = await adminDb
        .collection('users')
        .where('username', '==', updateData.username.toLowerCase())
        .get();

      if (!usernameCheck.empty && usernameCheck.docs[0].id !== id) {
        return reply.code(400).send({ error: 'Username no disponible' });
      }

      // Convertir username a minúsculas
      updateData.username = updateData.username.toLowerCase();
    }

    // Procesar archivos si existen
    if (formData.photo) {
      try {
        const buffer = await formData.photo.toBuffer();
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: 'avatars',
                width: 400,
                height: 400,
                crop: 'fill',
                gravity: 'face',
              },
              (error, result) => {
                if (error) {
                  logger.error('Error al subir foto de perfil a Cloudinary:', error);
                  reject(error);
                }
                resolve(result);
              }
            )
            .end(buffer);
        });

        // Actualizar tanto photoURL como avatarUrl
        updateData.photoURL = result.secure_url;
        updateData.avatarUrl = result.secure_url;
        updateData.avatarPublicId = result.public_id;
      } catch (error) {
        logger.error('Error al subir foto de perfil a Cloudinary:', error);
        return reply.code(500).send({ error: 'Error al subir foto de perfil' });
      }
    }

    if (formData.banner) {
      try {
        const buffer = await formData.banner.toBuffer();
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: 'banners',
                width: 1500,
                height: 500,
                crop: 'fill',
              },
              (error, result) => {
                if (error) {
                  logger.error('Error al subir banner a Cloudinary:', error);
                  reject(error);
                }
                resolve(result);
              }
            )
            .end(buffer);
        });

        updateData.bannerURL = result.secure_url;
        updateData.bannerUrl = result.secure_url;
        updateData.bannerPublicId = result.public_id;
      } catch (error) {
        logger.error('Error al subir banner a Cloudinary:', error);
        return reply.code(500).send({ error: 'Error al subir banner' });
      }
    }

    // Actualizar el documento en Firestore
    await adminDb
      .collection('users')
      .doc(id)
      .update({
        ...updateData,
        updatedAt: new Date().toISOString(),
      });

    // Obtener el documento actualizado
    const updatedDoc = await adminDb.collection('users').doc(id).get();
    const updatedData = updatedDoc.data();

    return reply.send({
      success: true,
      profile: prepareUserDataForClient(updatedData),
    });
  } catch (error) {
    logger.error('Error al actualizar perfil:', error);
    return reply.code(500).send({ error: 'Error al actualizar perfil' });
  }
};

// Obtener imágenes que le gustan al usuario
export const getLikedImages = async (request, reply) => {
  try {
    const { username } = request.params;

    // Primero obtener el ID del usuario por username
    const userSnapshot = await adminDb
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }

    const userId = userSnapshot.docs[0].id;

    // Obtener los likes del usuario
    const likesSnapshot = await adminDb.collection('likes').where('userId', '==', userId).get();

    // Obtener los IDs de las imágenes con like
    const imageIds = likesSnapshot.docs.map((doc) => doc.data().imageId);

    // Obtener los detalles de las imágenes
    const imagesPromises = imageIds.map(async (imageId) => {
      const imageDoc = await adminDb.collection('images').doc(imageId).get();
      if (imageDoc.exists) {
        return {
          id: imageDoc.id,
          ...imageDoc.data(),
        };
      }
      return null;
    });

    const images = (await Promise.all(imagesPromises)).filter((img) => img !== null);

    return reply.send(images);
  } catch (error) {
    logger.error('Error al obtener imágenes con like:', error);
    return reply.code(500).send({ error: 'Error al obtener imágenes con like' });
  }
};

// Obtener colecciones del usuario
export const getCollections = async (request, reply) => {
  try {
    const { username } = request.params;

    // Primero obtener el ID del usuario por username
    const userSnapshot = await adminDb
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }

    const userId = userSnapshot.docs[0].id;

    // Obtener las colecciones del usuario
    const collectionsSnapshot = await adminDb
      .collection('collections')
      .where('userId', '==', userId)
      .get();

    const collections = await Promise.all(
      collectionsSnapshot.docs.map(async (doc) => {
        const collectionData = doc.data();

        // Obtener las imágenes de la colección
        const imagesPromises = collectionData.imageIds.map(async (imageId) => {
          const imageDoc = await adminDb.collection('images').doc(imageId).get();
          if (imageDoc.exists) {
            return {
              id: imageDoc.id,
              ...imageDoc.data(),
            };
          }
          return null;
        });

        const images = (await Promise.all(imagesPromises)).filter((img) => img !== null);

        return {
          id: doc.id,
          name: collectionData.name,
          description: collectionData.description,
          createdAt: collectionData.createdAt,
          images,
        };
      })
    );

    return reply.send(collections);
  } catch (error) {
    logger.error('Error al obtener colecciones:', error);
    return reply.code(500).send({ error: 'Error al obtener colecciones' });
  }
};
