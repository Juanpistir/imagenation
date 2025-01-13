const { db } = require('../config/firebase.config');

class User {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.username = data.username || '';
    this.photoURL = data.photoURL || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastLogin = data.lastLogin || new Date();
    this.roles = data.roles || ['user'];
    this.preferences = data.preferences || {};
    this.stats = {
      uploads: data.stats?.uploads || 0,
      likes: data.stats?.likes || 0,
      comments: data.stats?.comments || 0,
      views: data.stats?.views || 0
    };
  }

  static async create(userData) {
    if (!userData || !userData.uid || !userData.email) {
      throw new Error('Usuario y email son requeridos');
    }

    const userRef = db.collection('users').doc(userData.uid);
    const user = new User({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: new Date()
    });

    await userRef.set({
      uid: user.uid,
      email: user.email,
      username: user.username,
      photoURL: user.photoURL,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      roles: user.roles,
      preferences: user.preferences,
      stats: user.stats
    });

    return user;
  }

  static async findById(uid) {
    if (!uid) return null;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;

    return new User(userDoc.data());
  }

  static async findByEmail(email) {
    if (!email) return null;

    const userSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userSnapshot.empty) return null;

    return new User(userSnapshot.docs[0].data());
  }

  async update(data) {
    const userRef = db.collection('users').doc(this.uid);
    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    await userRef.update(updateData);
    Object.assign(this, updateData);
    return this;
  }

  async updateLastLogin() {
    return this.update({ lastLogin: new Date() });
  }

  async incrementStat(statName, amount = 1) {
    if (!this.stats.hasOwnProperty(statName)) {
      throw new Error(`Estadística inválida: ${statName}`);
    }

    const userRef = db.collection('users').doc(this.uid);
    const updateData = {
      [`stats.${statName}`]: this.stats[statName] + amount,
      updatedAt: new Date()
    };

    await userRef.update(updateData);
    this.stats[statName] += amount;
    return this;
  }

  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      username: this.username,
      photoURL: this.photoURL,
      roles: this.roles,
      stats: this.stats,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin
    };
  }

  // Métodos de autorización
  hasRole(role) {
    return this.roles.includes(role);
  }

  isAdmin() {
    return this.hasRole('admin');
  }

  canModerate() {
    return this.hasRole('admin') || this.hasRole('moderator');
  }
}

module.exports = User;
