const { Comments } = require('./index');
const { Timestamp } = require('firebase/firestore');

const commentConverter = {
  toFirestore: (comment) => {
    return {
      image_id: comment.image_id,
      userId: comment.userId,
      email: comment.email || '',
      name: comment.name || '',
      gravatar: comment.gravatar || '',
      comment: comment.comment || '',
      timestamp: Timestamp.now()
    };
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      ...data
    };
  }
};

const Comment = {
  collection: Comments.withConverter(commentConverter),

  async find(query = {}) {
    let ref = this.collection;
    if (query.image_id) {
      ref = ref.where('image_id', '==', query.image_id);
    }
    const snapshot = await ref.get();
    return snapshot.docs.map(doc => doc.data());
  },

  async create(data) {
    const docRef = await this.collection.add(data);
    return (await docRef.get()).data();
  },

  async deleteMany(query, userId) {
    const snapshot = await this.collection
      .where('image_id', '==', query.image_id)
      .where('userId', '==', userId)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }
};

module.exports = Comment;
