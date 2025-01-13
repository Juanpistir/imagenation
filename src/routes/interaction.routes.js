const fastifyPlugin = require('fastify-plugin');
const { createLogger, format, transports } = require('winston');
const View = require('../models/view');
const Like = require('../models/like');
const Comment = require('../models/comment');

// Configurar logger
const logger = createLogger({
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `🕒 ${timestamp} | ${level} | 👥 Interaction Service | ${message} ${metaStr}`;
    })
  ),
  transports: [new transports.Console()]
});

// Esquemas de validación
const commentSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          minLength: 1,
          maxLength: 1000
        }
      }
    }
  }
};

async function routes(fastify, options) {
  // Middleware para verificar token
  const verifyToken = async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'No autorizado' });
    }
  };

  // Rate limiting configurations
  const standardRateLimit = {
    max: 100,
    timeWindow: '1 minute'
  };

  const sensitiveRateLimit = {
    max: 20,
    timeWindow: '1 minute'
  };

  // Registrar una vista
  fastify.post('/api/images/:imageId/view', {
    preHandler: verifyToken,
    config: {
      rateLimit: standardRateLimit
    },
    handler: async (request, reply) => {
      try {
        const { imageId } = request.params;
        const userId = request.user.uid;
        const ip = request.ip;

        const view = await View.create({
          imageId,
          userId,
          ip
        });

        logger.info('View registered', { imageId, userId });
        return { success: true, viewCount: await View.getViewCount(imageId) };
      } catch (error) {
        logger.error('Error registering view:', { error: error.message });
        reply.code(500).send({ error: 'Error al registrar la vista' });
      }
    }
  });

  // Dar/quitar like
  fastify.post('/api/images/:imageId/like', {
    preHandler: verifyToken,
    config: {
      rateLimit: standardRateLimit
    },
    handler: async (request, reply) => {
      try {
        const { imageId } = request.params;
        const userId = request.user.uid;

        const existingLike = await Like.findByUserAndImage(imageId, userId);
        
        if (existingLike) {
          await Like.delete(imageId, userId);
          logger.info('Like removed', { imageId, userId });
          return { 
            success: true, 
            action: 'unliked',
            likeCount: await Like.getLikeCount(imageId)
          };
        } else {
          await Like.create({ imageId, userId });
          logger.info('Like added', { imageId, userId });
          return { 
            success: true, 
            action: 'liked',
            likeCount: await Like.getLikeCount(imageId)
          };
        }
      } catch (error) {
        logger.error('Error toggling like:', { error: error.message });
        reply.code(500).send({ error: 'Error al procesar el like' });
      }
    }
  });

  // Verificar si el usuario dio like
  fastify.get('/api/images/:imageId/like', {
    preHandler: verifyToken,
    handler: async (request, reply) => {
      try {
        const { imageId } = request.params;
        const userId = request.user.uid;

        const hasLiked = await Like.hasUserLiked(imageId, userId);
        const likeCount = await Like.getLikeCount(imageId);

        return { 
          hasLiked, 
          likeCount 
        };
      } catch (error) {
        logger.error('Error checking like status:', { error: error.message });
        reply.code(500).send({ error: 'Error al verificar estado del like' });
      }
    }
  });

  // Crear comentario
  fastify.post('/api/images/:imageId/comments', {
    preHandler: verifyToken,
    config: {
      rateLimit: sensitiveRateLimit
    },
    ...commentSchema,
    handler: async (request, reply) => {
      try {
        const { imageId } = request.params;
        const { content } = request.body;
        const userId = request.user.uid;
        const { username, photoURL } = request.user;

        const comment = await Comment.create({
          imageId,
          userId,
          content,
          username,
          userPhotoURL: photoURL
        });

        logger.info('Comment created', { imageId, userId });
        return { 
          success: true, 
          comment,
          commentCount: await Comment.getCommentCount(imageId)
        };
      } catch (error) {
        logger.error('Error creating comment:', { error: error.message });
        reply.code(500).send({ error: 'Error al crear el comentario' });
      }
    }
  });

  // Obtener comentarios
  fastify.get('/api/images/:imageId/comments', {
    handler: async (request, reply) => {
      try {
        const { imageId } = request.params;
        const { limit = 10, startAfter = null } = request.query;

        const comments = await Comment.getByImage(imageId, limit, startAfter);
        const commentCount = await Comment.getCommentCount(imageId);

        return { 
          comments, 
          commentCount,
          hasMore: comments.length === limit
        };
      } catch (error) {
        logger.error('Error fetching comments:', { error: error.message });
        reply.code(500).send({ error: 'Error al obtener los comentarios' });
      }
    }
  });

  // Eliminar comentario
  fastify.delete('/api/images/:imageId/comments/:commentId', {
    preHandler: verifyToken,
    config: {
      rateLimit: sensitiveRateLimit
    },
    handler: async (request, reply) => {
      try {
        const { commentId } = request.params;
        const userId = request.user.uid;

        await Comment.delete(commentId, userId);

        logger.info('Comment deleted', { commentId, userId });
        return { 
          success: true,
          message: 'Comentario eliminado exitosamente'
        };
      } catch (error) {
        logger.error('Error deleting comment:', { error: error.message });
        
        if (error.message === 'No autorizado para eliminar este comentario') {
          return reply.code(403).send({ error: error.message });
        }
        
        reply.code(500).send({ error: 'Error al eliminar el comentario' });
      }
    }
  });

  // Editar comentario
  fastify.put('/api/images/:imageId/comments/:commentId', {
    preHandler: verifyToken,
    config: {
      rateLimit: sensitiveRateLimit
    },
    ...commentSchema,
    handler: async (request, reply) => {
      try {
        const { commentId } = request.params;
        const { content } = request.body;
        const userId = request.user.uid;

        const updatedComment = await Comment.update(commentId, userId, content);

        logger.info('Comment updated', { commentId, userId });
        return { 
          success: true,
          comment: updatedComment
        };
      } catch (error) {
        logger.error('Error updating comment:', { error: error.message });
        
        if (error.message === 'No autorizado para editar este comentario') {
          return reply.code(403).send({ error: error.message });
        }
        
        reply.code(500).send({ error: 'Error al actualizar el comentario' });
      }
    }
  });
}

module.exports = fastifyPlugin(routes, {
  name: 'interactionRoutes',
  dependencies: ['@fastify/jwt']
});
