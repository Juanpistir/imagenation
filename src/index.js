require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ logger: true });
const handlebars = require('handlebars');

async function start() {
  try {
    // Configuración básica
    await fastify.register(require('@fastify/cors'));
    await fastify.register(require('@fastify/formbody'));
    await fastify.register(require('@fastify/multipart'), {
      addToBody: false,
      throwFileSizeLimit: true,
      limits: {
        fieldNameSize: 100,    // Max field name size in bytes
        fieldSize: 100000,     // Max field value size in bytes
        fields: 10,            // Max number of non-file fields
        fileSize: 5000000,     // Max file size 5MB
        files: 1,              // Max number of file fields
        headerPairs: 2000      // Max number of header key=>value pairs
      },
      onFile: (fieldName, stream, filename, encoding, mimetype) => {
        fastify.log.info('Archivo recibido:', { fieldName, filename, encoding, mimetype });
      }
    });
    await fastify.register(require('@fastify/static'), {
      root: path.join(__dirname, 'public'),
      prefix: '/public/'
    });

    // Registrar parciales de Handlebars
    const fs = require('fs');
    const partialsDir = path.join(__dirname, 'views/partials');
    const filenames = fs.readdirSync(partialsDir);

    filenames.forEach(function (filename) {
      const matches = /^([^.]+).hbs$/.exec(filename);
      if (!matches) {
        return;
      }
      const name = matches[1];
      const template = fs.readFileSync(path.join(partialsDir, filename), 'utf8');
      handlebars.registerPartial(name, template);
    });

    // View engine
    await fastify.register(require('@fastify/view'), {
      engine: {
        handlebars: handlebars
      },
      root: path.join(__dirname, 'views'),
      layout: 'layouts/main',
      viewExt: 'hbs'
    });

    // Rutas
    fastify.register(require('./routes/auth.routes'));
    fastify.register(require('./routes/views.routes'));
    fastify.register(require('./routes/images.routes'), { prefix: '/images' });

    // Ruta principal
    fastify.get('/', async (request, reply) => {
      return reply.view('index');
    });

    // Iniciar servidor
    await fastify.listen({ port: process.env.PORT || 3000 });
    console.log('Servidor corriendo en puerto', process.env.PORT || 3000);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
