const { Images, Comments } = require("../models");
const { db } = require("../config/firebase.config");
const admin = require('firebase-admin');
const md5 = require("md5");
const stats = require("../helpers/stats");
const {
  imageSchema,
  imageQuerySchema,
  imageSearchSchema
} = require('../schemas/image.schema');
const { pipeline } = require('stream');
const { promisify } = require('util');

const finished = promisify(pipeline);

const imageController = {
  async getImage(request, reply) {
    try {
      const { id } = await imageQuerySchema.parseAsync(request.params);
      const image = await Images.findOne(id);
      
      if (!image) {
        return reply.status(404).send({ error: 'Imagen no encontrada' });
      }

      const comments = await Comments.find(id);

      return reply.view("image", await stats.getSidebar({
        image,
        comments,
        imageUrl: image.imageUrl
      }));
    } catch (error) {
      request.log.error(error);
      if (error.name === 'ZodError') {
        reply.status(400).send({
          error: 'ID de imagen inválido',
          details: error.errors
        });
        return;
      }
      throw new Error('Error al obtener la imagen');
    }
  },

  async createImage(request, reply) {
    try {
      // Verificar si el usuario está autenticado
      if (!request.user) {
        return reply.status(401).send({ 
          error: 'Debes iniciar sesión para subir imágenes' 
        });
      }

      request.log.info('Iniciando carga de imagen para usuario:', request.user.uid);
      
      // Verificar que la solicitud sea multipart
      if (!request.isMultipart()) {
        request.log.error('La solicitud no es multipart');
        return reply.status(400).send({ error: 'La solicitud debe ser multipart/form-data' });
      }

      const data = {};
      let fileFound = false;
      
      try {
        const parts = await request.parts();
        
        for await (const part of parts) {
          request.log.info('Procesando parte:', {
            fieldname: part.fieldname,
            type: part.type,
            mimetype: part.mimetype
          });

          if (part.type === 'file' && part.fieldname === 'image') {
            fileFound = true;
            try {
              const chunks = [];
              for await (const chunk of part.file) {
                chunks.push(chunk);
              }
              data.imageBuffer = Buffer.concat(chunks);
              data.filename = part.filename;
              request.log.info(`Archivo procesado: ${part.filename}, tamaño: ${data.imageBuffer.length} bytes`);
            } catch (fileError) {
              request.log.error('Error procesando el archivo:', fileError);
              throw new Error('Error al procesar el archivo subido');
            }
          } else {
            try {
              const value = await part.value;
              data[part.fieldname] = value;
              request.log.info(`Campo procesado: ${part.fieldname} = ${value}`);
            } catch (fieldError) {
              request.log.error(`Error procesando campo ${part.fieldname}:`, fieldError);
            }
          }
        }

        if (!fileFound) {
          throw new Error('No se encontró el campo de archivo en el formulario');
        }

      } catch (parseError) {
        request.log.error('Error al parsear las partes:', parseError);
        return reply.status(400).send({ 
          error: 'Error al procesar el formulario',
          details: parseError.message 
        });
      }

      // Validar que todos los campos requeridos estén presentes
      if (!data.imageBuffer) {
        request.log.error('No se encontró la imagen en la solicitud');
        return reply.status(400).send({ error: 'No se proporcionó ninguna imagen' });
      }

      if (!data.title || !data.description) {
        request.log.error('Faltan campos requeridos:', { 
          title: !!data.title, 
          description: !!data.description 
        });
        return reply.status(400).send({ error: 'El título y la descripción son requeridos' });
      }

      // Crear la imagen con el userId del usuario autenticado
      const result = await Images.create({
        filename: data.filename,
        title: data.title,
        description: data.description,
        userId: request.user.uid,
        timestamp: new Date()
      }, data.imageBuffer);

      request.log.info('Imagen creada exitosamente');
      return reply.redirect('/');
    } catch (error) {
      request.log.error('Error al procesar la imagen:', error);
      return reply.status(500).send({ 
        error: 'Error procesando la imagen',
        details: error.message 
      });
    }
  },

  async likeImage(request, reply) {
    try {
      const { image_id } = request.params;
      const image = await Images.findOne(image_id);
      
      if (!image) {
        reply.status(404).send({ error: 'Imagen no encontrada' });
        return;
      }

      const updatedImage = await Images.updateLikes(image_id, image.likes + 1);
      return reply.send({ likes: updatedImage.likes });
    } catch (error) {
      request.log.error(error);
      throw new Error('Error al dar like a la imagen');
    }
  },

  async commentImage(request, reply) {
    try {
      const { image_id } = request.params;
      const image = await Images.findOne(image_id);
      
      if (!image) {
        reply.status(404).send({ error: 'Imagen no encontrada' });
        return;
      }

      await Comments.create({ 
        ...request.body,
        gravatar: md5(request.body.email),
        image_id: image_id // Usar el ID de Firebase directamente
      });
      return reply.redirect(`/images/${image_id}`);
    } catch (error) {
      request.log.error(error);
      throw new Error('Error al comentar en la imagen');
    }
  },

  async deleteImage(request, reply) {
    try {
      const { image_id } = request.params;
      const image = await Images.findOne(image_id);
      
      if (!image) {
        reply.status(404).send({ error: 'Imagen no encontrada' });
        return;
      }

      await Images.deleteImage(image.publicId);
      return reply.send({ message: 'Imagen eliminada' });
    } catch (error) {
      request.log.error(error);
      throw new Error('Error al eliminar la imagen');
    }
  },

  async searchImages(request, reply) {
    try {
      const { query } = await imageSearchSchema.parseAsync(request.query);
      
      const snapshot = await db.collection('images')
        .where('title', '>=', query)
        .where('title', '<=', query + '\uf8ff')
        .get();

      const images = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return reply.send({ results: images });
    } catch (error) {
      request.log.error(error);
      throw new Error('Error en la búsqueda de imágenes');
    }
  }
};

module.exports = imageController;