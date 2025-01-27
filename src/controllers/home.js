import { getFirestore } from 'firebase-admin/firestore';
import { getLogger } from '../utils/logger.js';
import { errors } from '../utils/error-handler.js';
import { normalizeUserData } from '../utils/userUtils.js';

const logger = getLogger('home:controller');

export async function index(request, reply) {
  try {
    logger.info('Iniciando carga de página principal');

    const db = getFirestore();

    // Debug: Verificar request.user
    logger.info('Datos de request.user:', request.user);

    // Obtener y normalizar datos del usuario
    const userData = normalizeUserData(request.user);
    if (userData) {
      logger.info('userData después de normalización:', userData);
    } else {
      logger.info('No hay usuario autenticado en request.user');
    }

    // Debug: Verificar token
    const token = request.cookies.token;
    logger.info('Token en cookies:', !!token);

    // Obtener las imágenes
    const imagesCollection = db.collection('images');
    const imagesQuery = imagesCollection.orderBy('timestamp', 'desc').limit(20);
    const imagesSnapshot = await imagesQuery.get();

    logger.info(`Se encontraron ${imagesSnapshot.size} imágenes`);

    // Procesar las imágenes
    const images = [];
    for (const docSnap of imagesSnapshot.docs) {
      const data = docSnap.data();
      const commentsSnapshot = await db
        .collection('images')
        .doc(docSnap.id)
        .collection('comments')
        .get();

      images.push({
        id: docSnap.id,
        title: data.title || 'Sin título',
        description: data.description || '',
        imageUrl: data.mainImageUrl || data.imageUrl || '',
        timestamp: data.timestamp?.toDate() || new Date(),
        likes: Array.isArray(data.likes) ? data.likes.length : 0,
        hasLiked: Array.isArray(data.likes) && data.likes.includes(request.user?.uid),
        views: data.views || 0,
        commentCount: commentsSnapshot.size || 0,
        userId: data.userId,
      });
    }

    // Calcular estadísticas
    const stats = {
      totalImages: images.length,
      totalLikes: images.reduce((sum, img) => sum + (img.likes || 0), 0),
      totalViews: images.reduce((sum, img) => sum + (img.views || 0), 0),
    };

    logger.info('Estadísticas calculadas:', stats);

    logger.info('Datos enviados a la vista:', {
      userExists: !!userData,
      userData: userData,
      imagesCount: images.length,
      stats,
    });

    return reply.renderWithContext('index', {
      images,
      user: userData,
      ...stats,
      error: null,
    });
  } catch (error) {
    logger.error('Error al cargar la página principal:', error);
    throw errors.internalError('Error al cargar la página principal');
  }
}
