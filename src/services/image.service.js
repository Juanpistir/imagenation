
class ImageService {
  constructor(db) {
    this.db = db;
  }

  async searchByTitle(title) {
    try {
      const images = await this.db.collection('images')
        .where('title', '>=', title)
        .where('title', '<=', title + '\uf8ff')
        .get();

      return images.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ImageService;