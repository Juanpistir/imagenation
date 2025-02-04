import { uploadImage, searchImages, getImage, deleteImage, updateImage, toggleLike, addComment, deleteComment } from '../controllers/image.js';

export default async function imageRoutes(fastify, opts) {
  // Helper para registrar rutas con y sin prefijo /api
  const registerRoute = (method, path, handler, options = {}) => {
    const apiPath = `/api${path}`;
    const defaultOptions = { preHandler: fastify.FBAuth, ...options };
    
    // Registrar ruta con prefijo /api
    fastify[method](apiPath, defaultOptions, handler);
    // Registrar ruta sin prefijo
    fastify[method](path, defaultOptions, handler);
  };

  // Subir imagen
  registerRoute('post', '/images/upload', uploadImage);

  // Buscar imágenes
  registerRoute('get', '/images/search', searchImages);

  // Obtener imagen por ID
  registerRoute('get', '/images/:id', getImage);

  // Eliminar imagen
  registerRoute('delete', '/images/:id', deleteImage);

  // Actualizar imagen
  registerRoute('put', '/images/:id', updateImage);

  // Like/Unlike imagen
  registerRoute('post', '/images/:id/like', toggleLike);

  // Comentarios
  registerRoute('post', '/images/:id/comments', addComment);
  registerRoute('delete', '/images/:id/comments/:commentId', deleteComment);
}
