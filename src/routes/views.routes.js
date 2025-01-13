async function routes(fastify, options) {
  // Ruta de login
  fastify.get('/login', async (request, reply) => {
    return reply.view('auth/login');
  });

  // Ruta de registro
  fastify.get('/register', async (request, reply) => {
    return reply.view('auth/register');
  });
}

module.exports = routes;
