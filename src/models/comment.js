const { db } = require('../config/firebase.config');

class Comment {
  constructor(data) {
    this.id = data.id;
    this.imageId = data.imageId;
    this.userId = data.userId;
    this.content = data.content;
    this.timestamp = data.timestamp || new Date();
    this.edited = data.edited || false;
    this.username = data.username;
    this.userPhotoURL = data.userPhotoURL;
  }

  static async create(commentData) {
    if (!commentData.imageId || !commentData.userId || !commentData.content) {
      throw new Error('ImageId, userId y content son requeridos');
    }

    const commentRef = db.collection('comments').doc();
    const comment = new Comment({
      id: commentRef.id,
      ...commentData
    });

    await commentRef.set({
      id: comment.id,
      imageId: comment.imageId,
      userId: comment.userId,
      content: comment.content,
      timestamp: comment.timestamp,
      edited: comment.edited,
      username: comment.username,
      userPhotoURL: comment.userPhotoURL
    });

    // Incrementar el contador de comentarios en la imagen
    const imageRef = db.collection('images').doc(comment.imageId);
    await db.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);
      if (!imageDoc.exists) {
        throw new Error('La imagen no existe');
      }
      
      transaction.update(imageRef, {
        commentCount: (imageDoc.data().commentCount || 0) + 1
      });
    });

    return comment;
  }

  static async delete(commentId, userId) {
    if (!commentId) {
      throw new Error('CommentId es requerido');
    }

    const commentRef = db.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      throw new Error('Comentario no encontrado');
    }

    const commentData = commentDoc.data();
    
    // Verificar que el usuario sea el propietario del comentario o tenga rol de admin
    if (commentData.userId !== userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data().roles.includes('admin')) {
        throw new Error('No autorizado para eliminar este comentario');
      }
    }

    await commentRef.delete();

    // Decrementar el contador de comentarios en la imagen
    const imageRef = db.collection('images').doc(commentData.imageId);
    await db.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);
      if (!imageDoc.exists) {
        throw new Error('La imagen no existe');
      }
      
      const currentComments = imageDoc.data().commentCount || 0;
      transaction.update(imageRef, {
        commentCount: Math.max(0, currentComments - 1)
      });
    });

    return true;
  }

  static async update(commentId, userId, content) {
    if (!commentId || !content) {
      throw new Error('CommentId y content son requeridos');
    }

    const commentRef = db.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      throw new Error('Comentario no encontrado');
    }

    // Verificar que el usuario sea el propietario del comentario
    if (commentDoc.data().userId !== userId) {
      throw new Error('No autorizado para editar este comentario');
    }

    await commentRef.update({
      content,
      edited: true,
      timestamp: new Date()
    });

    return new Comment({
      ...commentDoc.data(),
      content,
      edited: true,
      timestamp: new Date()
    });
  }

  static async getByImage(imageId, limit = 10, startAfter = null) {
    if (!imageId) return [];

    let query = db.collection('comments')
      .where('imageId', '==', imageId)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const commentsSnapshot = await query.get();
    return commentsSnapshot.docs.map(doc => new Comment(doc.data()));
  }

  static async getCommentCount(imageId) {
    if (!imageId) return 0;

    const imageDoc = await db.collection('images').doc(imageId).get();
    return imageDoc.exists ? (imageDoc.data().commentCount || 0) : 0;
  }
}

module.exports = Comment;
