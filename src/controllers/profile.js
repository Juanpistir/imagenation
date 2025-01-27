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
      id: userDoc.id
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

    // Obtener las imágenes del usuario
    const imagesSnapshot = await adminDb
      .collection('images')
      .where('userId', '==', id)
      .orderBy('createdAt', 'desc')
      .get();

    const images = imagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      mainImageUrl: doc.data().mainImageUrl,
      createdAt: doc.data().createdAt
    }));

    logger.info(`Se encontraron ${images.length} imágenes para el usuario`);

    // Preparar datos seguros para Alpine.js
    const profileData = {
      id: userDoc.id,
      ...userData,
      images: Array.isArray(images) ? images : [],
      isOwner: currentUserData?.uid === userDoc.id
    };

    logger.info('Datos del perfil preparados para el cliente:', profileData);

    const serializedData = JSON.stringify(profileData).replace(/</g, '\\u003c');
    logger.info('Datos serializados:', serializedData);

    return reply.renderWithContext('profile.hbs', {
      profile: profileData,
      PROFILE_DATA: serializedData,
      user: currentUserData,
      error: null
    });

  } catch (error) {
    logger.error('Error al obtener perfil:', error);
    return reply.renderWithContext('error.hbs', {
      error: 'Error interno del servidor',
      user: request.user,
      statusCode: 500
    });
  }
};

export const updateProfile = async (request, reply) => {
  try {
    const { id } = request.params;
    const updates = request.body;

    // Verificar que el usuario autenticado sea el mismo que se intenta actualizar
    if (request.user.uid !== id) {
      logger.error('Usuario no autorizado para actualizar este perfil');
      return reply.code(403).send({ error: 'No autorizado para actualizar este perfil' });
    }

    // Validar los campos actualizables
    const allowedUpdates = ['displayName', 'photoURL', 'bio'];
    const updateData = {};

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    // Si hay una nueva foto de perfil, subirla a Cloudinary
    if (request.file) {
      try {
        const result = await cloudinary.uploader.upload(request.file.path, {
          folder: 'profiles',
          transformation: [{ width: 200, height: 200, crop: 'fill' }],
        });
        updateData.photoURL = result.secure_url;
      } catch (error) {
        logger.error('Error al subir imagen a Cloudinary:', error);
        return reply.code(500).send({ error: 'Error al subir imagen de perfil' });
      }
    }

    // Actualizar el perfil en Firestore
    await adminDb.collection('users').doc(id).update(updateData);

    return reply.send({
      message: 'Perfil actualizado exitosamente',
      updates: updateData,
    });
  } catch (error) {
    logger.error('Error al actualizar perfil:', error);
    return reply.code(500).send({ error: 'Error interno del servidor' });
  }
};
