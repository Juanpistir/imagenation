const imageController = require('../controllers/image');

async function imageRoutes(fastify, options) {
  // Rutas específicas primero
  fastify.get('/search', imageController.searchImages);
  
  // Rutas con parámetros después
  fastify.get('/:id', imageController.getImage);
  fastify.post('/', imageController.createImage);
  fastify.post('/:image_id/like', imageController.likeImage);
  fastify.post('/:image_id/comment', imageController.commentImage);
  fastify.delete('/:image_id', imageController.deleteImage);
}

module.exports = imageRoutes;
