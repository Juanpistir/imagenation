import { getLogger } from './logger.js';
const logger = getLogger('error-handler');

class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Errores predefinidos
const errors = {
  badRequest: (message = 'Solicitud inválida', details = null) =>
    new AppError(400, message, details),
  unauthorized: (message = 'No autorizado', details = null) => new AppError(401, message, details),
  forbidden: (message = 'Acceso denegado', details = null) => new AppError(403, message, details),
  notFound: (message = 'Recurso no encontrado', details = null) =>
    new AppError(404, message, details),
  validationError: details => new AppError(400, 'Error de validación', details),
  internalError: (message = 'Error interno del servidor', details = null) =>
    new AppError(500, message, details),
};

// Manejador de errores para Fastify
function errorHandler(error, request, reply) {
  logger.error('Error en la aplicación:', {
    error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
  });

  // Si es un error de validación de Fastify
  if (error.validation) {
    const validationError = errors.validationError(error.validation);
    return reply.status(validationError.statusCode).send(validationError);
  }

  // Si es un error personalizado de la aplicación
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error);
  }

  // Si es un error de Firebase
  if (error.code && error.code.startsWith('auth/')) {
    const firebaseError = errors.unauthorized(error.message);
    return reply.status(firebaseError.statusCode).send(firebaseError);
  }

  // Error por defecto
  const defaultError = errors.internalError(error.message);
  return reply.status(defaultError.statusCode).send(defaultError);
}

// Helper para manejar errores en controladores async
function asyncHandler(handler) {
  return async (request, reply) => {
    try {
      await handler(request, reply);
    } catch (error) {
      errorHandler(error, request, reply);
    }
  };
}

export { AppError, errors, errorHandler, asyncHandler };
