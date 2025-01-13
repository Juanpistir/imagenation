const fastifyPlugin = require('fastify-plugin');
const Redis = require('ioredis');
const { promisify } = require('util');

async function sessionMiddleware(fastify, options) {
  // Configuración de Redis
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'imagenation:session:',
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  // Manejar eventos de Redis
  redis.on('error', (err) => {
    fastify.log.error('Redis error:', err);
  });

  redis.on('connect', () => {
    fastify.log.info('Redis connected successfully');
  });

  // Agregar Redis a Fastify
  fastify.decorate('redis', redis);

  // Middleware de sesión
  fastify.decorateRequest('session', null);
  fastify.addHook('preHandler', async (request, reply) => {
    const sessionId = request.cookies.sessionId;

    if (!sessionId) {
      request.session = { isNew: true };
      return;
    }

    try {
      const sessionData = await redis.get(sessionId);
      if (!sessionData) {
        request.session = { isNew: true };
        return;
      }

      request.session = {
        id: sessionId,
        ...JSON.parse(sessionData),
        isNew: false
      };

      // Extender la expiración de la sesión
      await redis.expire(sessionId, 24 * 60 * 60); // 24 horas
    } catch (error) {
      fastify.log.error('Session error:', error);
      request.session = { isNew: true };
    }
  });

  // Métodos de sesión
  fastify.decorate('createSession', async (data, expiresIn = 24 * 60 * 60) => {
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    await redis.set(sessionId, JSON.stringify(data), 'EX', expiresIn);
    return sessionId;
  });

  fastify.decorate('destroySession', async (sessionId) => {
    if (!sessionId) return;
    await redis.del(sessionId);
  });

  // Limpiar Redis al cerrar
  fastify.addHook('onClose', async (instance) => {
    await redis.quit();
  });
}

module.exports = fastifyPlugin(sessionMiddleware);
