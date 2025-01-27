import fastify from 'fastify';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getLogger } from './utils/logger.js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fastifyView } from '@fastify/view';
import { fastifyStatic } from '@fastify/static';
import handlebars from 'handlebars';
import { readdir, readFile } from 'fs/promises';
import { basename } from 'path';
import { helpers } from './helpers.js';

// Cargar variables de entorno
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = getLogger('app');

// Función para cargar parciales automáticamente (ya no necesitamos retornar un objeto)
async function loadPartials(partialsDir) {
  try {
    const partialFiles = await readdir(partialsDir);

    for (const file of partialFiles) {
      if (file.endsWith('.hbs')) {
        const name = basename(file, '.hbs');
        const content = await readFile(join(partialsDir, file), 'utf8');
        handlebars.registerPartial(name, content);
      }
    }
  } catch (error) {
    logger.error('Error cargando parciales:', error);
    throw error;
  }
}

async function build(opts = {}) {
  const app = fastify({ logger: true });

  try {
    // Registrar plugins personalizados primero
    await app.register(import('./plugins/decorators.js'));
    await app.register(import('./plugins/authNuevo.js'));

    await app.register(import('@fastify/compress'), {
      global: false,
    });

    await app.register(import('@fastify/cookie'), {
      secret: process.env.COOKIE_SECRET,
      hook: 'onRequest',
      parseOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    });

    // Configuración de multipart
    await app.register(import('@fastify/multipart'), {
      limits: {
        fieldSize: 10 * 1024 * 1024, // 10 MB
        fileSize: 5 * 1024 * 1024, // 5 MB para archivos
        files: 2, // Máximo 2 archivos por solicitud
      },
    });

    // Registrar helper de currentYear
    handlebars.registerHelper('currentYear', () => new Date().getFullYear());

    // Registrar helpers de Handlebars
    Object.entries(helpers).forEach(([name, fn]) => {
      handlebars.registerHelper(name, fn);
    });

    // Cargar parciales directamente en Handlebars
    const partialsDir = join(__dirname, 'views/partials');
    await loadPartials(partialsDir);

    // Servir archivos de node_modules
    await app.register(fastifyStatic, {
      root: join(__dirname, '../node_modules'),
      prefix: '/node_modules/',
      decorateReply: false,
      setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      },
    });

    // Servir archivos públicos
    await app.register(fastifyStatic, {
      root: join(__dirname, 'public'),
      prefix: '/public/',
      decorateReply: false,
      setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      },
    });

    // Configurar el plugin de vistas sin la opción partials
    await app.register(fastifyView, {
      engine: {
        handlebars: handlebars,
      },
      root: join(__dirname, 'views'),
      layout: 'layouts/main.hbs',
      defaultContext: {
        dev: process.env.NODE_ENV !== 'production',
        asset: (path) => {
          if (process.env.NODE_ENV === 'production') {
            const manifest = JSON.parse(readFileSync('./dist/manifest.json', 'utf-8'));
            return manifest[path] || path;
          }
          return `http://localhost:5173${path}`;
        },
      },
    });

    // Registrar rutas después de todos los plugins
    await app.register(import('./routes/images.js'));
    await app.register(import('./routes/index.js'));
    await app.register(import('./routes/profile.js'));
    await app.register(import('./routes/auth.js'));

    // Manejador de errores global
    app.setErrorHandler((error, request, reply) => {
      logger.error('Error en la aplicación:', error);

      if (error.validation) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: error.message,
          validation: error.validation,
        });
      }

      const statusCode = error.statusCode || 500;
      reply.status(statusCode).send({
        statusCode,
        error: error.name || 'Internal Server Error',
        message: error.message || 'Ha ocurrido un error inesperado',
      });
    });

    // Hook para manejo de errores no capturados
    app.addHook('onError', async (request, reply, error) => {
      logger.error('Error no capturado:', error);
    });

    logger.info('Aplicación configurada correctamente');
    return app;
  } catch (error) {
    logger.error('Error configurando la aplicación:', error);
    throw error;
  }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const app = await build();
    await app.listen({
      port: process.env.PORT || 3000,
      host: process.env.HOST || '0.0.0.0',
      backlog: 511,
    });

    logger.info(
      `Servidor escuchando en ${process.env.HOST || '0.0.0.0'}:${process.env.PORT || 3000}`
    );

    // Manejo de señales para cierre graceful
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, async () => {
        logger.info(`Señal ${signal} recibida, cerrando servidor...`);
        try {
          await app.close();
          logger.info('Servidor cerrado correctamente');
          process.exit(0);
        } catch (err) {
          logger.error('Error cerrando el servidor:', err);
          process.exit(1);
        }
      });
    }
  } catch (error) {
    logger.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
}

export default build;
