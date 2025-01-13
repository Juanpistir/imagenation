const { auth } = require('../config/firebase.config');
const { createLogger, format, transports } = require('winston');

// Configurar logger
const logger = createLogger({
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `🕒 ${timestamp} | ${level} | 🔒 Auth Middleware | ${message} ${metaStr}`;
    })
  ),
  transports: [new transports.Console()]
});

const REFRESH_THRESHOLD = 5 * 60; // 5 minutos antes de expirar

async function verifyAndRefreshToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      logger.warn('No authorization header found');
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      logger.warn('No token found in authorization header');
      return null;
    }

    logger.info('Token recibido en middleware:', idToken);

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      // Verificar si el token está cerca de expirar
      const tokenExp = decodedToken.exp;
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenExp - currentTime <= REFRESH_THRESHOLD) {
        // Token está cerca de expirar, generar uno nuevo
        logger.info('Token cerca de expirar, generando nuevo token');
        
        // Crear nuevo token usando custom claims del token actual
        const newToken = await auth.createCustomToken(decodedToken.uid, {
          email: decodedToken.email,
          name: decodedToken.name,
          roles: decodedToken.roles || ['user']
        });

        // Agregar el nuevo token al response header
        reply.header('X-New-Token', newToken);
      }

      return decodedToken;
    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        logger.warn('Token expirado, intentando renovar');
        
        // Intentar obtener información del usuario del token expirado
        const decodedExpiredToken = await auth.verifyIdToken(idToken, true);
        
        // Crear nuevo token
        const newToken = await auth.createCustomToken(decodedExpiredToken.uid, {
          email: decodedExpiredToken.email,
          name: decodedExpiredToken.name,
          roles: decodedExpiredToken.roles || ['user']
        });

        // Agregar el nuevo token al response header
        reply.header('X-New-Token', newToken);
        
        // Devolver la información del usuario del token expirado
        return decodedExpiredToken;
      }
      
      throw error;
    }
  } catch (error) {
    logger.error('Error en middleware de autenticación:', error.message);
    return null;
  }
}

async function requireAuth(request, reply) {
  const decodedToken = await verifyAndRefreshToken(request, reply);
  
  if (!decodedToken) {
    reply.code(401).send({ 
      error: 'No autorizado',
      message: 'Token inválido o expirado'
    });
    return;
  }

  // Agregar información del usuario al request
  request.user = {
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
    roles: decodedToken.roles || ['user']
  };
}

async function optionalAuth(request, reply) {
  const decodedToken = await verifyAndRefreshToken(request, reply);
  
  if (decodedToken) {
    request.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      roles: decodedToken.roles || ['user']
    };
  }
}

function requireRole(role) {
  return async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'No autorizado' });
      return;
    }

    if (!request.user.roles.includes(role)) {
      reply.code(403).send({ error: 'Acceso denegado' });
      return;
    }
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole
};
