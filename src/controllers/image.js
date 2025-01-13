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
      const data = await request.file();
      const chunks = [];
      
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const result = await Images.create({
        filename: data.filename,
        title: data.filename
      }, buffer);
      
      reply.redirect('/');
    } catch (error) {
      request.log.error(error);
      reply.status(500).send('Error procesando la imagen');
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