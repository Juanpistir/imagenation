import fp from 'fastify-plugin';
import { getLogger } from '../utils/logger.js';
const logger = getLogger('decorators');

async function decorators(fastify, options) {
  // Decorador para renderizar vistas con contexto
  fastify.decorateReply('renderWithContext', function (template, data) {
    const context = {
      ...data,
      appName: 'Imagenation',
      isProduction: process.env.NODE_ENV === 'production',
    };
    return this.view(template, context);
  });

  logger.info('Decorators registrados correctamente');
}

// Exportar como plugin
export default fp(decorators, {
  name: 'decorators',
});
