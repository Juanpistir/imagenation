const path = require('path');
const cloudinary = require('cloudinary').v2;
const { pipeline } = require('stream');
const { promisify } = require('util');

const finished = promisify(pipeline);

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const homeController = require('../controllers/home');
const imageRoutes = require('./images.routes');

async function routes(fastify, options) {
  // Registrar las rutas de imágenes bajo el prefijo /images
  fastify.register(imageRoutes, { prefix: '/images' });
  
  // Ruta principal protegida usando el middleware de autenticación
  fastify.get('/', { preHandler: [fastify.authenticate] }, homeController.index);
}

module.exports = routes;