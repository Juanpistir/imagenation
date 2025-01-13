const { db } = require('../config/firebase.config');

class Like {
  constructor(data) {
    this.id = data.id;
    this.imageId = data.imageId;
    this.userId = data.userId;
    this.timestamp = data.timestamp || new Date();
  }

  static async create(likeData) {
    if (!likeData.imageId || !likeData.userId) {
      throw new Error('ImageId y userId son requeridos');
    }

    // Verificar si ya existe un like del usuario
    const existingLike = await Like.findByUserAndImage(likeData.imageId, likeData.userId);
    if (existingLike) {
      return existingLike;
    }

    const likeRef = db.collection('likes').doc();
    const like = new Like({
      id: likeRef.id,
      ...likeData
    });

    await likeRef.set({
      id: like.id,
      imageId: like.imageId,
      userId: like.userId,
      timestamp: like.timestamp
    });

    // Incrementar el contador de likes en la imagen
    const imageRef = db.collection('images').doc(like.imageId);
    await db.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);
      if (!imageDoc.exists) {
        throw new Error('La imagen no existe');
      }
      
      transaction.update(imageRef, {
        likeCount: (imageDoc.data().likeCount || 0) + 1
      });
    });

    return like;
  }

  static async delete(imageId, userId) {
    if (!imageId || !userId) {
      throw new Error('ImageId y userId son requeridos');
    }

    const likeSnapshot = await db.collection('likes')
      .where('imageId', '==', imageId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (likeSnapshot.empty) {
      return false;
    }

    const likeDoc = likeSnapshot.docs[0];
    await likeDoc.ref.delete();

    // Decrementar el contador de likes en la imagen
    const imageRef = db.collection('images').doc(imageId);
    await db.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);
      if (!imageDoc.exists) {
        throw new Error('La imagen no existe');
      }
      
      const currentLikes = imageDoc.data().likeCount || 0;
      transaction.update(imageRef, {
        likeCount: Math.max(0, currentLikes - 1)
      });
    });

    return true;
  }

  static async findByUserAndImage(imageId, userId) {
    if (!imageId || !userId) return null;

    const likeSnapshot = await db.collection('likes')
      .where('imageId', '==', imageId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (likeSnapshot.empty) return null;

    return new Like(likeSnapshot.docs[0].data());
  }

  static async getLikeCount(imageId) {
    if (!imageId) return 0;

    const imageDoc = await db.collection('images').doc(imageId).get();
    return imageDoc.exists ? (imageDoc.data().likeCount || 0) : 0;
  }

  static async hasUserLiked(imageId, userId) {
    const like = await Like.findByUserAndImage(imageId, userId);
    return !!like;
  }
}

module.exports = Like;
