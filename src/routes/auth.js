import { login, register, createUserInDatabase } from '../controllers/auth.js';

export default async function routes(fastify, options) {
  // Rutas que requieren NO estar autenticado
  fastify.get(
    '/auth/login',
    {
      preHandler: async (request, reply) => {
        if (request.user) return reply.redirect('/');
      },
    },
    login
  );

  fastify.get(
    '/auth/register',
    {
      preHandler: async (request, reply) => {
        if (request.user) return reply.redirect('/');
      },
    },
    register
  );

  // Ruta de registro - No requiere autenticación
  fastify.post('/auth/register', createUserInDatabase);
}
