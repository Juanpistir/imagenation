const { db } = require('../config/firebase.config');

class View {
  constructor(data) {
    this.id = data.id;
    this.imageId = data.imageId;
    this.userId = data.userId;
    this.timestamp = data.timestamp || new Date();
    this.ip = data.ip;
  }

  static async create(viewData) {
    if (!viewData.imageId || !viewData.userId) {
      throw new Error('ImageId y userId son requeridos');
    }

    // Verificar si ya existe una vista del usuario en las últimas 24 horas
    const existingView = await View.findRecentByUser(viewData.imageId, viewData.userId);
    if (existingView) {
      return existingView;
    }

    const viewRef = db.collection('views').doc();
    const view = new View({
      id: viewRef.id,
      ...viewData
    });

    await viewRef.set({
      id: view.id,
      imageId: view.imageId,
      userId: view.userId,
      timestamp: view.timestamp,
      ip: view.ip
    });

    // Incrementar el contador de vistas en la imagen
    const imageRef = db.collection('images').doc(view.imageId);
    await db.runTransaction(async (transaction) => {
      const imageDoc = await transaction.get(imageRef);
      if (!imageDoc.exists) {
        throw new Error('La imagen no existe');
      }
      
      transaction.update(imageRef, {
        viewCount: (imageDoc.data().viewCount || 0) + 1
      });
    });

    return view;
  }

  static async findRecentByUser(imageId, userId) {
    if (!imageId || !userId) return null;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const viewsSnapshot = await db.collection('views')
      .where('imageId', '==', imageId)
      .where('userId', '==', userId)
      .where('timestamp', '>', oneDayAgo)
      .limit(1)
      .get();

    if (viewsSnapshot.empty) return null;

    return new View(viewsSnapshot.docs[0].data());
  }

  static async getViewCount(imageId) {
    if (!imageId) return 0;

    const imageDoc = await db.collection('images').doc(imageId).get();
    return imageDoc.exists ? (imageDoc.data().viewCount || 0) : 0;
  }
}

module.exports = View;
