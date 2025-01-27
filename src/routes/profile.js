import { getProfile, updateProfile } from '../controllers/profile.js';

export default async function profileRoutes(fastify, opts) {
  // Ruta para obtener el perfil
  fastify.get('/profile/:id', { preHandler: fastify.FBAuth }, getProfile);

  // Ruta para actualizar el perfil
  fastify.put('/profile/:id', { preHandler: fastify.FBAuth }, updateProfile);
}
