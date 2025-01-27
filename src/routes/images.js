import { uploadImage, searchImages, getImage, deleteImage, updateImage, toggleLike, addComment, deleteComment } from '../controllers/image.js';

export default async function imageRoutes(fastify, opts) {
  // Subir imagen
  fastify.post('/images/upload', { preHandler: fastify.FBAuth }, uploadImage);

  // Buscar imágenes
  fastify.get('/images/search', { preHandler: fastify.FBAuth }, searchImages);

  // Obtener imagen por ID
  fastify.get('/images/:id', { preHandler: fastify.FBAuth }, getImage);

  // Eliminar imagen
  fastify.delete('/images/:id', { preHandler: fastify.FBAuth }, deleteImage);

  // Actualizar imagen
  fastify.put('/images/:id', { preHandler: fastify.FBAuth }, updateImage);

  // Like/Unlike imagen
  fastify.post('/images/:id/like', { preHandler: fastify.FBAuth }, toggleLike);

  // Comentarios
  fastify.post('/images/:id/comments', { preHandler: fastify.FBAuth }, addComment);
  fastify.delete('/images/:id/comments/:commentId', { preHandler: fastify.FBAuth }, deleteComment);
}
