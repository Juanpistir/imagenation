const { db, storage } = require('../config/firebase.config');
const Comment = require('./comment');
const Like = require('./like');
const View = require('./view');

class Image {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.title = data.title;
    this.description = data.description || '';
    this.url = data.url;
    this.thumbnailUrl = data.thumbnailUrl;
    this.storageRef = data.storageRef;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.tags = data.tags || [];
    this.viewCount = data.viewCount || 0;
    this.likeCount = data.likeCount || 0;
    this.commentCount = data.commentCount || 0;
    this.status = data.status || 'active';
    this.metadata = data.metadata || {};
  }

  static async create(imageData) {
    if (!imageData.userId || !imageData.url || !imageData.storageRef) {
      throw new Error('UserId, url y storageRef son requeridos');
    }

    const imageRef = db.collection('images').doc();
    const image = new Image({
      id: imageRef.id,
      ...imageData
    });

    await imageRef.set({
      id: image.id,
      userId: image.userId,
      title: image.title,
      description: image.description,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      storageRef: image.storageRef,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      tags: image.tags,
      viewCount: image.viewCount,
      likeCount: image.likeCount,
      commentCount: image.commentCount,
      status: image.status,
      metadata: image.metadata
    });

    return image;
  }

  static async findById(id) {
    if (!id) return null;

    const imageDoc = await db.collection('images').doc(id).get();
    if (!imageDoc.exists) return null;

    return new Image(imageDoc.data());
  }

  async delete(userId) {
    // Verificar propiedad de la imagen
    if (this.userId !== userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data().roles.includes('admin')) {
        throw new Error('No autorizado para eliminar esta imagen');
      }
    }

    // Eliminar archivos de Storage
    try {
      const mainFileRef = storage.ref(this.storageRef);
      await mainFileRef.delete();

      if (this.thumbnailUrl) {
        const thumbnailRef = storage.ref(this.storageRef.replace('images/', 'thumbnails/'));
        await thumbnailRef.delete();
      }
    } catch (error) {
      console.error('Error eliminando archivos:', error);
      // Continuamos con la eliminación de la base de datos incluso si falla Storage
    }

    // Eliminar comentarios
    const commentsSnapshot = await db.collection('comments')
      .where('imageId', '==', this.id)
      .get();
    
    const batch = db.batch();
    commentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Eliminar likes
    const likesSnapshot = await db.collection('likes')
      .where('imageId', '==', this.id)
      .get();
    
    likesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Eliminar vistas
    const viewsSnapshot = await db.collection('views')
      .where('imageId', '==', this.id)
      .get();
    
    viewsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Eliminar la imagen
    batch.delete(db.collection('images').doc(this.id));

    // Ejecutar todas las eliminaciones en una transacción
    await batch.commit();

    return true;
  }

  async update(data, userId) {
    // Verificar propiedad de la imagen
    if (this.userId !== userId) {
      throw new Error('No autorizado para actualizar esta imagen');
    }

    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    await db.collection('images').doc(this.id).update(updateData);
    Object.assign(this, updateData);
    return this;
  }

  static async getByUser(userId, limit = 10, startAfter = null) {
    if (!userId) return [];

    let query = db.collection('images')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const imagesSnapshot = await query.get();
    return imagesSnapshot.docs.map(doc => new Image(doc.data()));
  }

  static async search(query = '', tags = [], limit = 10, startAfter = null) {
    let baseQuery = db.collection('images')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc');

    if (tags && tags.length > 0) {
      baseQuery = baseQuery.where('tags', 'array-contains-any', tags);
    }

    if (startAfter) {
      baseQuery = baseQuery.startAfter(startAfter);
    }

    baseQuery = baseQuery.limit(limit);

    const imagesSnapshot = await baseQuery.get();
    const images = imagesSnapshot.docs.map(doc => new Image(doc.data()));

    if (query) {
      return images.filter(image => 
        image.title.toLowerCase().includes(query.toLowerCase()) ||
        image.description.toLowerCase().includes(query.toLowerCase())
      );
    }

    return images;
  }
}

module.exports = Image;
