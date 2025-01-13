const { auth } = require('../config/firebase.config');
const User = require('../models/user');

// Middleware para verificar autenticación
async function isAuthenticated(request, reply) {
  try {
    // Verificar si hay una sesión activa
    if (!request.session || request.session.isNew) {
      return reply.code(401).send({
        error: 'No autenticado',
        message: 'Debe iniciar sesión para acceder a este recurso'
      });
    }

    // Verificar si el usuario existe en nuestra base de datos
    const user = await User.findById(request.session.uid);
    if (!user) {
      await request.server.destroySession(request.session.id);
      return reply.code(401).send({
        error: 'Usuario no encontrado',
        message: 'La sesión ha expirado o el usuario ya no existe'
      });
    }

    // Agregar usuario a la request
    request.user = user;
  } catch (error) {
    request.log.error('Error en autenticación:', error);
    return reply.code(401).send({
      error: 'Error de autenticación',
      message: 'Ha ocurrido un error al verificar la autenticación'
    });
  }
}

// Middleware para verificar roles
function hasRole(roles) {
  return async (request, reply) => {
    try {
      const userRoles = request.user.roles || ['user'];
      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return reply.code(403).send({
          error: 'Acceso denegado',
          message: 'No tiene los permisos necesarios para acceder a este recurso'
        });
      }
    } catch (error) {
      request.log.error('Error en verificación de roles:', error);
      return reply.code(403).send({
        error: 'Error de autorización',
        message: 'Ha ocurrido un error al verificar los permisos'
      });
    }
  };
}

// Middleware para verificar propiedad de un recurso
function isOwner(resourceType) {
  return async (request, reply) => {
    try {
      const resourceId = request.params.id;
      if (!resourceId) {
        return reply.code(400).send({
          error: 'ID no proporcionado',
          message: 'Se requiere un ID para verificar la propiedad'
        });
      }

      let resource;
      switch (resourceType) {
        case 'image':
          resource = await Image.findById(resourceId);
          break;
        case 'comment':
          resource = await Comment.findById(resourceId);
          break;
        default:
          throw new Error(`Tipo de recurso no soportado: ${resourceType}`);
      }

      if (!resource) {
        return reply.code(404).send({
          error: 'Recurso no encontrado',
          message: `El ${resourceType} no existe`
        });
      }

      if (resource.userId !== request.user.uid && !request.user.canModerate()) {
        return reply.code(403).send({
          error: 'Acceso denegado',
          message: 'No tiene permiso para modificar este recurso'
        });
      }

      // Agregar recurso a la request para uso posterior
      request.resource = resource;
    } catch (error) {
      request.log.error('Error en verificación de propiedad:', error);
      return reply.code(403).send({
        error: 'Error de autorización',
        message: 'Ha ocurrido un error al verificar la propiedad del recurso'
      });
    }
  };
}

// Middleware para rate limiting personalizado por usuario
function userRateLimit(config) {
  const limits = new Map();

  return async (request, reply) => {
    const userId = request.user.uid;
    const now = Date.now();
    const userLimit = limits.get(userId) || { count: 0, resetTime: now + config.timeWindow };

    // Limpiar límites expirados
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + config.timeWindow;
    }

    // Verificar límite
    if (userLimit.count >= config.max) {
      const waitTime = Math.ceil((userLimit.resetTime - now) / 1000);
      return reply.code(429).send({
        error: 'Límite excedido',
        message: `Demasiadas solicitudes. Intente nuevamente en ${waitTime} segundos`
      });
    }

    // Incrementar contador
    userLimit.count++;
    limits.set(userId, userLimit);
  };
}

module.exports = {
  isAuthenticated,
  hasRole,
  isOwner,
  userRateLimit
};
