import { index } from '../controllers/home.js';

export default async function routes(fastify, options) {
  // Ruta principal
  fastify.get('/', { preHandler: fastify.FBAuth }, index);
}