require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({
  logger: true // Simplificar el logger para debug
});
const handlebars = require('handlebars');
const { timeago } = require('./helpers/handlebars');
const fastifyCookie = require('@fastify/cookie');

// Registrar el helper
handlebars.registerHelper('timeago', timeago);

// Registro de plugins
async function registerPlugins() {
  // Rate limit - configuración modificada para rutas específicas
  await fastify.register(require('@fastify/rate-limit'), {
    global: false,  // Deshabilitar globalmente
    max: 5,
    timeWindow: '15 minutes',
    errorHandler: (req, reply) => {
      reply.code(429).send({ 
        error: 'Demasiados intentos. Intenta de nuevo más tarde.' 
      });
    }
  });

  // JWT plugin - debe ir ANTES del auth middleware
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'imagenation-node',
    sign: {
      expiresIn: '1d' // tokens expiran en 1 día
    }
  });

  // Auth middleware - ahora va DESPUÉS de JWT
  await fastify.register(require('./plugins/auth.middleware'));

  // Multipart - ya registrado aquí
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 5000000 // 5MB
    }
  });

  // Formbody - para formularios HTML
  await fastify.register(require('@fastify/formbody'));

  // View engine - configuración corregida
  await fastify.register(require('@fastify/view'), {
    engine: {
      handlebars: handlebars  // Usar la instancia de handlebars donde registramos el helper
    },
    root: path.join(__dirname, 'views'),
    layout: 'layouts/main',
    options: {
      partials: {
        'image-card': 'partials/image-card.hbs',  // Añadir esta línea
        stats: 'partials/stats.hbs',
        navbar: 'partials/navbar.hbs',
        footer: 'partials/footer.hbs'
      }
    },
    viewExt: 'hbs',
    defaultContext: {
      env: {
        FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: process.env.FIREBASE_APP_ID
      }
    }
  });

  // Static files
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/public/'
  });

  // Security
  await fastify.register(require('@fastify/cors'));
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "script-src": ["'self'", "'unsafe-inline'", "https:"],
        "style-src": ["'self'", "'unsafe-inline'", "https:"]
      }
    }
  });

  // Registrar el plugin de cookies
  await fastify.register(fastifyCookie);

  // Rutas de vistas de autenticación
  fastify.get('/login', async (request, reply) => {
    return reply.view('auth/login');
  });

  fastify.get('/register', async (request, reply) => {
    return reply.view('auth/register');
  });

  // Rutas públicas (auth)
  await fastify.register(require('./routes/auth.routes'), { prefix: '/api' });

  // Rutas principales y protegidas
  await fastify.register(async function(fastify) {
    // Primero registrar rutas principales
    await fastify.register(require('./routes'));
    
    // Luego agregar el middleware de autenticación solo para rutas protegidas
    fastify.addHook('preHandler', fastify.authenticate);
  });
}

// Manejador de errores global
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

// Iniciar servidor - Modificar la función start
async function start() {
  try {
    await registerPlugins();
    
    const port = process.env.PORT || 3000;
    const address = await fastify.listen({ 
      port: port,
      host: '0.0.0.0' 
    });
    
    console.log(`Server listening at ${address}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

start();

