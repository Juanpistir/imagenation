const { db } = require('../config/firebase.config');

const UserModel = {
  async create(userData) {
    try {
      const userRef = db.collection('users').doc(userData.uid);
      await userRef.set({
        email: userData.email,
        username: userData.username,
        profilePicture: userData.profilePicture || null,
        authProvider: userData.authProvider || 'email',
        createdAt: new Date(),
        role: 'user',
        images: [],
        likes: [],
        comments: []
      });
      return await this.findById(userData.uid);
    } catch (error) {
      throw new Error('Error creating user');
    }
  },

  async findById(uid) {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return null;
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      throw new Error('Error finding user');
    }
  },

  async findByEmail(email) {
    try {
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding user by email');
    }
  }
};

module.exports = UserModel;
